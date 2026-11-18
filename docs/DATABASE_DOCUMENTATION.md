# Happy Camper BnB - Database Documentation

## Overview

This document provides comprehensive documentation of the PostgreSQL database schema, including all 58 tables, their columns, relationships, enums, and database functions.

**Database Platform:** Supabase (PostgreSQL with PostgREST API)  
**Total Tables:** 58  
**Total Enums:** 12  
**Database Functions:** 7  

---

## Table of Contents

1. [Database Enums](#database-enums)
2. [Core Domain Tables](#core-domain-tables)
3. [Reservation & Booking Tables](#reservation--booking-tables)
4. [Guest Management Tables](#guest-management-tables)
5. [Rate & Pricing Tables](#rate--pricing-tables)
6. [Accounting Tables](#accounting-tables)
7. [Payment Tables](#payment-tables)
8. [Housekeeping Tables](#housekeeping-tables)
9. [User & Security Tables](#user--security-tables)
10. [Group Block Tables](#group-block-tables)
11. [CRM & Marketing Tables](#crm--marketing-tables)
12. [System & Audit Tables](#system--audit-tables)
13. [Database Functions](#database-functions)
14. [Relationship Matrix](#relationship-matrix)

---

## Database Enums

### account_type
Account classification for Chart of Accounts.

| Value | Description |
|-------|-------------|
| `asset` | Assets (Cash, AR, etc.) |
| `liability` | Liabilities (AP, deposits) |
| `equity` | Owner's equity |
| `revenue` | Revenue accounts |
| `expense` | Expense accounts |
| `tax` | Tax liability accounts |

### app_role
System-wide user roles.

| Value | Description |
|-------|-------------|
| `super_admin` | Full system access (internal) |
| `internal_admin` | Internal staff admin |
| `admin` | Property administrator |
| `manager` | Property manager |
| `front_desk` | Front desk staff |
| `sales` | Sales team |
| `support` | Support team |
| `finance` | Finance team |

### assignment_status
Housekeeping assignment states.

| Value | Description |
|-------|-------------|
| `pending` | Not yet started |
| `in_progress` | Currently being cleaned |
| `completed` | Cleaning finished |
| `inspected` | Passed inspection |
| `declined` | Staff declined assignment |

### cleaning_type
Type of room cleaning required.

| Value | Description |
|-------|-------------|
| `stayover` | Guest staying, light clean |
| `departure` | Guest departed, full clean |
| `deep_clean` | Intensive deep cleaning |

### housekeeping_status
Room cleanliness status.

| Value | Description |
|-------|-------------|
| `clean` | Room is clean and ready |
| `dirty` | Room needs cleaning |
| `needs_inspection` | Cleaned, awaiting inspection |
| `out_of_order` | Not available for use |

### inventory_mode
Property inventory management mode.

| Value | Description |
|-------|-------------|
| `unit_required` | Specific room must be assigned |
| `type_floating` | Room type only, auto-assign |

### ledger_type
Type of financial ledger account.

| Value | Description |
|-------|-------------|
| `advance_deposit` | Prepaid deposits |
| `guest` | In-house guest folio |
| `city` | City ledger (AR) |

### occupancy_status
Room occupancy state.

| Value | Description |
|-------|-------------|
| `vacant` | Room is empty |
| `occupied` | Guest currently in room |

### property_type
Type of hospitality property.

| Value | Description |
|-------|-------------|
| `campground` | RV park / campground |
| `hotel` | Hotel / motel |

### reservation_status
Reservation lifecycle states.

| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting confirmation |
| `CONFIRMED` | Confirmed, awaiting arrival |
| `CHECKED_IN` | Guest is in-house |
| `CHECKED_OUT` | Guest has departed |
| `CANCELLED` | Reservation cancelled |
| `NO_SHOW` | Guest did not arrive |

### transaction_type
Financial transaction types.

| Value | Description |
|-------|-------------|
| `payment` | Payment received |
| `charge` | Charge posted |
| `transfer` | Balance transfer |
| `refund` | Refund issued |
| `adjustment` | Manual adjustment |

---

## Core Domain Tables

### organizations

Top-level tenant entity representing a company/brand.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `name` | text | NO | | Organization name |
| `payment_status` | text | NO | 'active' | Billing status |
| `billing_email` | text | YES | | Billing contact email |
| `share_chart_of_accounts` | boolean | YES | false | Share COA across properties |
| `share_reporting` | boolean | YES | false | Share reports across properties |
| `share_user_access` | boolean | YES | false | Share users across properties |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Relationships:**
- Has many: `properties`, `property_groups`, `guests`, `guest_sharing_groups`, `subscriptions`

---

### property_groups

Grouping of properties for shared settings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `organization_id` | uuid | NO | | FK to organizations |
| `name` | text | NO | | Group name |
| `share_chart_of_accounts` | boolean | NO | false | Share COA in group |
| `share_reporting` | boolean | NO | false | Share reports in group |
| `share_user_access` | boolean | NO | false | Share users in group |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Foreign Keys:**
- `organization_id` → `organizations.id`

---

### properties

Individual hotel/campground property.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `organization_id` | uuid | YES | | FK to organizations |
| `property_group_id` | uuid | YES | | FK to property_groups |
| `name` | text | NO | | Property name |
| `address` | text | NO | | Full address |
| `timezone` | text | NO | 'America/New_York' | Property timezone |
| `country` | text | YES | | Country code |
| `phone1` | text | YES | | Primary phone |
| `phone2` | text | YES | | Secondary phone |
| `email` | text | YES | | Property email |
| `website` | text | YES | | Website URL |
| `property_type` | property_type | NO | 'campground' | Hotel or campground |
| `inventory_mode` | inventory_mode | NO | 'unit_required' | Inventory assignment mode |
| `audit_date` | date | YES | | Current business date |
| `is_active` | boolean | NO | true | Active status |
| `max_sites` | integer | YES | | Maximum room count |
| `customer_id` | integer | YES | | External customer ID |
| `map_image_url` | text | YES | | Property map image |
| `map_width` | integer | YES | | Map width in pixels |
| `map_height` | integer | YES | | Map height in pixels |
| `payment_gateway_mode` | text | YES | | 'mock' or 'live' |
| `adyen_merchant_account` | text | YES | | Adyen merchant ID |
| `adyen_client_key` | text | YES | | Adyen client key |
| `require_mfa` | boolean | YES | false | Require 2FA |
| `session_timeout_minutes` | integer | YES | 15 | Inactivity timeout |
| `password_min_length` | integer | YES | 12 | Min password length |
| `password_require_uppercase` | boolean | YES | true | Require uppercase |
| `password_require_number` | boolean | YES | true | Require number |
| `password_require_special` | boolean | YES | true | Require special char |
| `password_rotation_days` | integer | YES | | Days until password expires |
| `max_failed_login_attempts` | integer | YES | 5 | Lockout threshold |
| `lockout_duration_minutes` | integer | YES | 30 | Lockout duration |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Foreign Keys:**
- `organization_id` → `organizations.id`
- `property_group_id` → `property_groups.id`

**Relationships:**
- Has many: `sites`, `site_types`, `reservations`, `rates`, `add_ons`, `accounts`, `ledger_accounts`, etc. (45+ child tables)

---

### site_types

Room/site category definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `name` | text | NO | | Type name (e.g., "Deluxe King") |
| `code` | text | YES | | Short code |
| `description` | text | YES | | Description |
| `base_price` | decimal(10,2) | NO | | Default nightly rate |
| `max_adults` | integer | YES | | Max adult occupancy |
| `max_children` | integer | YES | | Max child occupancy |
| `bed_type` | text | YES | | Bed configuration |
| `floor_size_sqft` | integer | YES | | Room size |
| `room_class` | text | YES | | Room class category |
| `room_views` | text[] | YES | | Available views |
| `featured_amenities` | text[] | YES | | Key amenities |
| `smoking_preference` | text | YES | | Smoking policy |
| `is_wheelchair_accessible` | boolean | YES | false | ADA accessible |
| `icon` | text | YES | | Display icon |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Foreign Keys:**
- `property_id` → `properties.id`

---

### sites

Individual rooms/sites in the property.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `site_type_id` | uuid | NO | | FK to site_types |
| `zone_id` | uuid | YES | | FK to housekeeping_zones |
| `site_number` | text | NO | | Room number |
| `description` | text | YES | | Room description |
| `floor` | text | YES | | Floor level |
| `max_occupancy` | integer | NO | 4 | Max guests |
| `amenities` | text[] | YES | | Room amenities |
| `bed_config` | text | YES | | Bed setup |
| `view_type` | text | YES | | Room view |
| `is_active` | boolean | NO | true | Available for booking |
| `is_ada_accessible` | boolean | YES | false | ADA compliant |
| `housekeeping_status` | housekeeping_status | YES | 'clean' | Cleanliness state |
| `occupancy_status` | occupancy_status | YES | 'vacant' | Occupancy state |
| `maintenance_status` | text | YES | | Maintenance notes |
| `connecting_room_id` | uuid | YES | | FK to sites (connecting) |
| `map_x` | decimal | YES | | Map X coordinate |
| `map_y` | decimal | YES | | Map Y coordinate |
| `map_width` | decimal | YES | | Icon width |
| `map_height` | decimal | YES | | Icon height |
| `rotation` | decimal | YES | | Map rotation angle |
| `max_vehicle_length` | integer | YES | | RV length limit |
| `slideouts` | integer | YES | | Number of slideouts allowed |
| `has_towing_vehicle_parking` | boolean | YES | | Truck parking |
| `has_towed_vehicle_parking` | boolean | YES | | Trailer parking |
| `site_access_type` | text | YES | | Pull-through/back-in |
| `unavailable_start_date` | date | YES | | Maintenance start |
| `unavailable_end_date` | date | YES | | Maintenance end |
| `unavailable_reason` | text | YES | | Reason for unavailability |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Foreign Keys:**
- `property_id` → `properties.id`
- `site_type_id` → `site_types.id`
- `zone_id` → `housekeeping_zones.id`
- `connecting_room_id` → `sites.id`

**Unique Constraints:**
- `(property_id, site_number)` - Room numbers unique per property

---

## Reservation & Booking Tables

### reservations

Core reservation records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `site_id` | uuid | YES | | FK to sites |
| `site_type_id` | uuid | YES | | FK to site_types |
| `guest_id` | uuid | NO | | FK to guests |
| `rate_id` | uuid | YES | | FK to rates |
| `group_block_id` | uuid | YES | | FK to group_blocks |
| `source_of_business_id` | uuid | YES | | FK to source_of_business |
| `city_ledger_account_id` | uuid | YES | | FK to ledger_accounts |
| `master_reservation_id` | uuid | YES | | FK to reservations (shared) |
| `share_group_id` | uuid | YES | | Shared room group |
| `confirmation_number` | text | NO | | Unique confirmation code |
| `check_in_date` | date | NO | | Arrival date |
| `check_out_date` | date | NO | | Departure date |
| `status` | reservation_status | NO | 'PENDING' | Current status |
| `total_price` | decimal(10,2) | NO | | Total reservation amount |
| `override_rate` | decimal(10,2) | YES | | Manual rate override |
| `guests_count` | integer | NO | 1 | Total guests |
| `adults_count` | integer | YES | | Number of adults |
| `children_count` | integer | YES | | Number of children |
| `special_requests` | text | YES | | Guest requests |
| `billing_instructions` | text | YES | | Billing notes |
| `is_share_master` | boolean | YES | false | Is master of share group |
| `assignment_locked` | boolean | YES | false | Prevent auto-assignment |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Foreign Keys:**
- `property_id` → `properties.id`
- `site_id` → `sites.id`
- `site_type_id` → `site_types.id`
- `guest_id` → `guests.id`
- `rate_id` → `rates.id`
- `group_block_id` → `group_blocks.id`
- `source_of_business_id` → `source_of_business.id`
- `city_ledger_account_id` → `ledger_accounts.id`
- `master_reservation_id` → `reservations.id`

---

### reservation_guests

Multiple guests per reservation (sharers).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `reservation_id` | uuid | NO | | FK to reservations |
| `guest_id` | uuid | NO | | FK to guests |
| `guest_confirmation_number` | text | NO | | Individual confirmation |
| `folio_number` | integer | NO | | Folio sequence number |
| `is_primary` | boolean | YES | false | Primary guest flag |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

**Foreign Keys:**
- `reservation_id` → `reservations.id`
- `guest_id` → `guests.id`

---

### reservation_add_ons

Add-ons attached to reservations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `reservation_id` | uuid | NO | | FK to reservations |
| `add_on_id` | uuid | NO | | FK to add_ons |
| `quantity` | integer | NO | 1 | Number of units |
| `price_at_booking` | decimal(10,2) | NO | | Locked-in price |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

**Foreign Keys:**
- `reservation_id` → `reservations.id`
- `add_on_id` → `add_ons.id`

---

### reservation_recommendations

AI-generated site recommendations.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `reservation_id` | uuid | NO | | FK to reservations |
| `recommended_sites` | jsonb | YES | | Array of site recommendations |
| `recommended_add_on` | jsonb | YES | | Suggested add-on |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### source_of_business

Booking source tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `code` | text | NO | | Source code |
| `definition` | text | NO | | Source description |
| `is_default` | boolean | NO | false | Default selection |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

## Guest Management Tables

### guests

Guest profile information.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `organization_id` | uuid | YES | | FK to organizations |
| `origin_property_id` | uuid | YES | | FK to properties (created at) |
| `email` | text | NO | | Email address |
| `first_name` | text | NO | | First name |
| `last_name` | text | NO | | Last name |
| `title` | text | YES | | Salutation |
| `phone` | text | YES | | Primary phone |
| `phone2` | text | YES | | Secondary phone |
| `street_address` | text | YES | | Street address |
| `city` | text | YES | | City |
| `state` | text | YES | | State/province |
| `zipcode` | text | YES | | Postal code |
| `country` | text | YES | | Country |
| `birthday` | date | YES | | Birth date |
| `anniversary` | date | YES | | Anniversary date |
| `likes_dislikes` | text | YES | | Preferences notes |
| `favorite_site_id` | uuid | YES | | FK to sites |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

**Foreign Keys:**
- `organization_id` → `organizations.id`
- `origin_property_id` → `properties.id`
- `favorite_site_id` → `sites.id`

---

### guest_room_preferences

Guest room preferences.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `guest_id` | uuid | NO | | FK to guests |
| `preference_type` | text | NO | | Type of preference |
| `preference_value` | text | NO | | Preference value |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### guest_sharing_groups

Cross-property guest sharing configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `organization_id` | uuid | NO | | FK to organizations |
| `name` | text | NO | | Group name |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### guest_sharing_group_members

Properties in a guest sharing group.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `group_id` | uuid | NO | | FK to guest_sharing_groups |
| `property_id` | uuid | NO | | FK to properties |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

## Rate & Pricing Tables

### rates

Rate plan definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `base_rate_id` | uuid | YES | | FK to rates (derived from) |
| `revenue_account_id` | uuid | YES | | FK to accounts |
| `rate_code` | text | NO | | Rate plan code |
| `description` | text | YES | | Rate description |
| `start_date` | date | NO | | Effective start |
| `end_date` | date | NO | | Effective end |
| `is_default` | boolean | NO | false | Default rate |
| `is_base_rate` | boolean | YES | false | Is a base rate |
| `deposit_requirement` | text | NO | 'none' | Deposit policy |
| `adjustment_type` | text | YES | | 'percentage' or 'fixed' |
| `adjustment_value` | decimal | YES | | Adjustment amount |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

**Foreign Keys:**
- `property_id` → `properties.id`
- `base_rate_id` → `rates.id`
- `revenue_account_id` → `accounts.id`

---

### rate_site_type_prices

Per-room-type pricing for rates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `rate_id` | uuid | NO | | FK to rates |
| `site_type_id` | uuid | NO | | FK to site_types |
| `price` | decimal(10,2) | NO | | Nightly price |
| `adjustment_type` | text | YES | | Override adjustment type |
| `adjustment_value` | decimal | YES | | Override adjustment |
| `created_at` | timestamptz | YES | now() | Creation timestamp |

---

### rate_seasons

Seasonal price adjustments.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `rate_id` | uuid | NO | | FK to rates |
| `season_name` | text | NO | | Season name |
| `start_date` | date | NO | | Season start |
| `end_date` | date | NO | | Season end |
| `multiplier` | decimal(5,2) | NO | 1.00 | Price multiplier |
| `adjustment_type` | text | YES | | Adjustment type |
| `adjustment_value` | decimal | YES | | Adjustment value |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

---

### rate_add_ons

Add-ons included with rates.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `rate_id` | uuid | NO | | FK to rates |
| `add_on_id` | uuid | NO | | FK to add_ons |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### rate_rules

Dynamic pricing rules.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `name` | text | NO | | Rule name |
| `rule_type` | text | NO | | Rule type |
| `conditions` | jsonb | NO | | Rule conditions |
| `multiplier` | decimal(5,2) | YES | | Price multiplier |
| `discount_amount` | decimal(10,2) | YES | | Fixed discount |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### seasons

Property-wide seasonal definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `name` | text | NO | | Season name |
| `start_date` | date | NO | | Start date |
| `end_date` | date | NO | | End date |
| `multiplier` | decimal(5,2) | NO | 1.00 | Price multiplier |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### add_ons

Ancillary products/services.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `account_id` | uuid | YES | | FK to accounts |
| `name` | text | NO | | Add-on name |
| `code` | text | YES | | Short code |
| `description` | text | YES | | Description |
| `price` | decimal(10,2) | NO | | Price |
| `charge_type` | text | NO | 'one_time' | 'one_time' or 'nightly' |
| `category` | text | YES | | Category |
| `is_active` | boolean | NO | true | Available for sale |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### guarantee_options

Payment guarantee types.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `code` | text | NO | | Guarantee code |
| `description` | text | NO | | Description |
| `sort_order` | integer | NO | 0 | Display order |
| `is_active` | boolean | NO | true | Active |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

## Accounting Tables

### account_groups

Chart of Accounts categories.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `name` | text | NO | | Group name |
| `account_type` | account_type | NO | | Account classification |
| `sort_order` | integer | YES | | Display order |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### accounts

General ledger accounts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `account_group_id` | uuid | NO | | FK to account_groups |
| `code` | text | NO | | Account code |
| `name` | text | NO | | Account name |
| `description` | text | YES | | Description |
| `normal_balance` | text | NO | 'credit' | 'debit' or 'credit' |
| `is_active` | boolean | NO | true | Active |
| `include_in_nightly_kpis` | boolean | NO | false | Include in RevPAR |
| `external_account` | text | YES | | External GL code |
| `payment_type` | text | YES | | Payment method type |
| `tax_rate_value` | decimal | YES | | Tax rate percentage |
| `tax_calculation_type` | text | YES | | Tax calculation method |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### account_taxes

Tax configuration for accounts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `revenue_account_id` | uuid | NO | | FK to accounts |
| `tax_account_id` | uuid | NO | | FK to accounts |
| `inclusive_of_tax_id` | uuid | YES | | FK to account_taxes |
| `rate_value` | decimal | NO | 0 | Tax rate |
| `calculation_type` | text | NO | | Calculation method |
| `sort_order` | integer | NO | 0 | Processing order |
| `is_active` | boolean | NO | true | Active |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### ledger_accounts

Guest folios and AR accounts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `reservation_id` | uuid | YES | | FK to reservations |
| `reservation_guest_id` | uuid | YES | | FK to reservation_guests |
| `guest_id` | uuid | YES | | FK to guests |
| `ledger_type` | ledger_type | NO | | Account type |
| `account_number` | text | YES | | Account number |
| `company_name` | text | YES | | Company (for city ledger) |
| `contact_name` | text | YES | | Contact name |
| `contact_email` | text | YES | | Contact email |
| `phone` | text | YES | | Phone |
| `street_address` | text | YES | | Address line 1 |
| `street_address_2` | text | YES | | Address line 2 |
| `city` | text | YES | | City |
| `state` | text | YES | | State |
| `zipcode` | text | YES | | Postal code |
| `country` | text | YES | | Country |
| `balance` | decimal(10,2) | NO | 0 | Current balance |
| `credit_limit` | decimal(10,2) | YES | | Credit limit |
| `payment_terms_days` | integer | YES | | Net terms |
| `is_active` | boolean | NO | true | Active |
| `opened_at` | timestamptz | NO | now() | Account opened |
| `closed_at` | timestamptz | YES | | Account closed |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### folio_postings

Transaction postings to folios.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `ledger_account_id` | uuid | NO | | FK to ledger_accounts |
| `account_id` | uuid | YES | | FK to accounts |
| `night_audit_id` | uuid | YES | | FK to night_audits |
| `ledger_transaction_id` | uuid | YES | | FK to ledger_transactions |
| `source_ledger_account_id` | uuid | YES | | FK (transfer source) |
| `source_posting_id` | uuid | YES | | FK (transfer source posting) |
| `voided_posting_id` | uuid | YES | | FK (voided original) |
| `posting_date` | date | NO | | Posting date |
| `posting_type` | text | NO | | Posting type |
| `description` | text | NO | | Description |
| `amount` | decimal(10,2) | NO | 0 | Amount |
| `debit_amount` | decimal(10,2) | YES | | Debit amount |
| `credit_amount` | decimal(10,2) | YES | | Credit amount |
| `running_balance` | decimal(10,2) | NO | 0 | Balance after posting |
| `posted_by` | uuid | YES | | Posted by user ID |
| `posted_by_name` | text | YES | | Posted by name |
| `transfer_note` | text | YES | | Transfer note |
| `is_voided` | boolean | YES | false | Voided flag |
| `voided_at` | timestamptz | YES | | Void timestamp |
| `voided_by` | uuid | YES | | Voided by user ID |
| `voided_by_name` | text | YES | | Voided by name |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### ledger_transactions

Ledger account transactions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `ledger_account_id` | uuid | NO | | FK to ledger_accounts |
| `account_id` | uuid | YES | | FK to accounts |
| `journal_entry_id` | uuid | YES | | FK to journal_entries |
| `transaction_date` | date | NO | | Transaction date |
| `transaction_type` | transaction_type | NO | | Transaction type |
| `description` | text | NO | | Description |
| `account_code` | text | YES | | Account code |
| `debit_amount` | decimal(10,2) | YES | | Debit |
| `credit_amount` | decimal(10,2) | YES | | Credit |
| `running_balance` | decimal(10,2) | YES | | Running balance |
| `reference_number` | text | YES | | Reference |
| `created_by` | uuid | YES | | Created by user |
| `posted_by_name` | text | YES | | Posted by name |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### journal_entries

Manual journal entries.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `entry_date` | date | NO | | Entry date |
| `description` | text | NO | | Description |
| `reference_number` | text | YES | | Reference number |
| `is_posted` | boolean | NO | false | Posted to GL |
| `posted_at` | timestamptz | YES | | Posted timestamp |
| `posted_by` | uuid | YES | | Posted by user |
| `created_by` | uuid | YES | | Created by user |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### journal_entry_lines

Journal entry line items.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `journal_entry_id` | uuid | NO | | FK to journal_entries |
| `account_id` | uuid | NO | | FK to accounts |
| `description` | text | YES | | Line description |
| `debit_amount` | decimal(10,2) | YES | | Debit |
| `credit_amount` | decimal(10,2) | YES | | Credit |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### city_ledger_invoices

AR invoices for city ledger.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `city_ledger_account_id` | uuid | NO | | FK to ledger_accounts |
| `reservation_id` | uuid | YES | | FK to reservations |
| `source_folio_id` | uuid | YES | | FK to ledger_accounts |
| `transfer_date` | date | NO | | Transfer date |
| `guest_name` | text | YES | | Guest name |
| `room_number` | text | YES | | Room number |
| `confirmation_number` | text | YES | | Confirmation |
| `checkout_date` | date | YES | | Checkout date |
| `original_amount` | decimal(10,2) | NO | | Original amount |
| `paid_amount` | decimal(10,2) | NO | 0 | Amount paid |
| `status` | text | NO | 'open' | Invoice status |
| `notes` | text | YES | | Notes |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

---

### city_ledger_invoice_payments

Payments applied to invoices.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `invoice_id` | uuid | NO | | FK to city_ledger_invoices |
| `payment_transaction_id` | uuid | NO | | FK to ledger_transactions |
| `applied_amount` | decimal(10,2) | NO | | Amount applied |
| `applied_at` | timestamptz | YES | now() | Applied timestamp |
| `applied_by_name` | text | YES | | Applied by name |

---

### dayend_closes

Day-end close records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `night_audit_id` | uuid | YES | | FK to night_audits |
| `close_date` | date | NO | | Close date |
| `status` | text | NO | 'open' | Close status |
| `total_revenue` | decimal(10,2) | YES | | Total revenue |
| `total_taxes` | decimal(10,2) | YES | | Total taxes |
| `total_payments` | decimal(10,2) | YES | | Total payments |
| `total_refunds` | decimal(10,2) | YES | | Total refunds |
| `opening_ar_balance` | decimal(10,2) | YES | | Opening AR |
| `closing_ar_balance` | decimal(10,2) | YES | | Closing AR |
| `account_summary` | jsonb | YES | | Account summary |
| `ledger_summary` | jsonb | YES | | Ledger summary |
| `closed_at` | timestamptz | YES | | Close timestamp |
| `closed_by` | uuid | YES | | Closed by user |
| `closed_by_name` | text | YES | | Closed by name |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### night_audits

Night audit processing records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `audit_date` | date | NO | | Audit date |
| `status` | text | NO | 'pending' | Audit status |
| `folios_processed` | integer | YES | 0 | Folios processed |
| `total_room_revenue` | decimal(10,2) | YES | | Room revenue |
| `total_tax_revenue` | decimal(10,2) | YES | | Tax revenue |
| `total_other_revenue` | decimal(10,2) | YES | | Other revenue |
| `total_payments` | decimal(10,2) | YES | | Payments |
| `notes` | text | YES | | Notes |
| `started_at` | timestamptz | YES | | Start time |
| `started_by` | uuid | YES | | Started by user |
| `completed_at` | timestamptz | YES | | Completion time |
| `completed_by` | uuid | YES | | Completed by user |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### night_audit_settings

Night audit configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties (unique) |
| `auto_run_enabled` | boolean | YES | false | Auto-run enabled |
| `auto_run_time` | time | YES | | Scheduled time |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### folio_split_rules

Folio splitting configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `reservation_id` | uuid | NO | | FK to reservations |
| `account_id` | uuid | YES | | FK to accounts |
| `split_type` | text | NO | | Split type |
| `is_active` | boolean | YES | true | Active |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

---

### folio_split_rule_allocations

Folio split allocations per guest.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `split_rule_id` | uuid | NO | | FK to folio_split_rules |
| `reservation_guest_id` | uuid | NO | | FK to reservation_guests |
| `allocation_value` | decimal | NO | | Allocation percentage/amount |
| `created_at` | timestamptz | YES | now() | Creation timestamp |

---

### statement_sends

AR statement email log.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `city_ledger_account_id` | uuid | NO | | FK to ledger_accounts |
| `statement_date` | date | NO | | Statement date |
| `sent_to_email` | text | NO | | Recipient email |
| `total_amount` | decimal(10,2) | NO | | Statement total |
| `sent_at` | timestamptz | YES | now() | Sent timestamp |
| `sent_by_name` | text | YES | | Sent by name |
| `is_mock` | boolean | YES | false | Test mode |

---

## Payment Tables

### payment_cards

Tokenized payment cards.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | YES | | FK to properties |
| `guest_id` | uuid | YES | | FK to guests |
| `reservation_id` | uuid | YES | | FK to reservations |
| `reservation_guest_id` | uuid | YES | | FK to reservation_guests |
| `ledger_account_id` | uuid | YES | | FK to ledger_accounts |
| `card_brand` | text | NO | | Card brand (visa, etc.) |
| `last_four_digits` | text | NO | | Last 4 digits |
| `cardholder_name` | text | NO | | Cardholder name |
| `expiry_month` | integer | NO | | Expiry month |
| `expiry_year` | integer | NO | | Expiry year |
| `card_sequence` | integer | YES | 1 | Card sequence number |
| `is_primary` | boolean | YES | false | Primary card flag |
| `token_status` | text | YES | 'active' | Token status |
| `is_mock` | boolean | YES | false | Test mode |
| `adyen_shopper_reference` | text | YES | | Adyen shopper ref |
| `adyen_recurring_reference` | text | YES | | Adyen token |
| `created_by` | uuid | YES | | Created by user |
| `created_by_name` | text | YES | | Created by name |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### payment_authorizations

Card authorization holds.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `payment_card_id` | uuid | NO | | FK to payment_cards |
| `ledger_account_id` | uuid | NO | | FK to ledger_accounts |
| `original_amount` | decimal(10,2) | NO | | Original auth amount |
| `current_amount` | decimal(10,2) | NO | | Current auth amount |
| `captured_amount` | decimal(10,2) | YES | 0 | Captured so far |
| `currency` | text | YES | 'USD' | Currency code |
| `status` | text | NO | 'active' | Auth status |
| `expires_at` | timestamptz | YES | | Expiration time |
| `is_mock` | boolean | YES | false | Test mode |
| `adyen_psp_reference` | text | YES | | Adyen PSP ref |
| `adyen_auth_code` | text | YES | | Auth code |
| `created_by` | uuid | YES | | Created by user |
| `created_by_name` | text | YES | | Created by name |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

---

### payment_transactions

Payment transaction records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `payment_card_id` | uuid | YES | | FK to payment_cards |
| `authorization_id` | uuid | YES | | FK to payment_authorizations |
| `reservation_id` | uuid | YES | | FK to reservations |
| `ledger_account_id` | uuid | YES | | FK to ledger_accounts |
| `folio_posting_id` | uuid | YES | | FK to folio_postings |
| `amount` | decimal(10,2) | NO | | Transaction amount |
| `currency` | text | YES | 'USD' | Currency code |
| `transaction_type` | text | NO | | Transaction type |
| `status` | text | NO | | Transaction status |
| `source` | text | NO | 'pms' | Source system |
| `is_mock` | boolean | YES | false | Test mode |
| `adyen_psp_reference` | text | YES | | Adyen PSP ref |
| `gateway_response` | jsonb | YES | | Gateway response |
| `created_by` | uuid | YES | | Created by user |
| `created_by_name` | text | YES | | Created by name |
| `created_at` | timestamptz | YES | now() | Creation timestamp |

---

## Housekeeping Tables

### housekeeping_staff

Housekeeping staff members.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `name` | text | NO | | Staff name |
| `is_active` | boolean | YES | true | Active |
| `max_hours` | decimal | YES | | Max hours per day |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### housekeeping_zones

Housekeeping zones/sections.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `name` | text | NO | | Zone name |
| `zone_type` | text | NO | 'floor' | Zone type |
| `sort_order` | integer | YES | | Display order |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### housekeeping_assignments

Room cleaning assignments.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `site_id` | uuid | NO | | FK to sites |
| `staff_id` | uuid | YES | | FK to housekeeping_staff |
| `assignment_date` | date | NO | | Assignment date |
| `cleaning_type` | cleaning_type | NO | | Type of cleaning |
| `status` | assignment_status | NO | 'pending' | Current status |
| `notes` | text | YES | | Assignment notes |
| `status_history` | jsonb | YES | | Status change log |
| `assigned_by` | uuid | YES | | Assigned by user |
| `completed_at` | timestamptz | YES | | Completion time |
| `completed_by` | uuid | YES | | Completed by user |
| `inspected_at` | timestamptz | YES | | Inspection time |
| `inspected_by` | uuid | YES | | Inspected by user |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### cleaning_preferences

Property cleaning settings.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties (unique) |
| `full_clean_interval` | integer | YES | | Days between deep cleans |
| `sheet_change_days` | integer | YES | | Days between sheet changes |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### room_type_cleaning_times

Estimated cleaning times per room type.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `site_type_id` | uuid | NO | | FK to site_types (unique) |
| `departure_minutes` | integer | NO | 45 | Departure clean time |
| `stayover_minutes` | integer | NO | 20 | Stayover clean time |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

## User & Security Tables

### user_roles

Global user role assignments.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `user_id` | uuid | NO | | User ID (Supabase Auth) |
| `role` | app_role | NO | | Role assignment |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

---

### user_property_access

User access to specific properties.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `user_id` | uuid | NO | | User ID (Supabase Auth) |
| `organization_id` | uuid | NO | | FK to organizations |
| `property_id` | uuid | YES | | FK to properties |
| `is_org_admin` | boolean | NO | false | Org-level admin |
| `created_at` | timestamptz | NO | now() | Creation timestamp |

**Foreign Keys:**
- `organization_id` → `organizations.id`
- `property_id` → `properties.id`

---

### custom_roles

Property-specific custom roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `name` | text | NO | | Role name |
| `description` | text | YES | | Role description |
| `permissions` | jsonb | NO | '{}' | Permission flags |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

---

### user_custom_roles

User-to-custom-role assignments.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `user_id` | uuid | NO | | User ID |
| `custom_role_id` | uuid | NO | | FK to custom_roles |
| `created_at` | timestamptz | YES | now() | Creation timestamp |

---

### login_attempts

Login attempt tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `user_id` | uuid | NO | | User ID |
| `property_id` | uuid | YES | | FK to properties |
| `success` | boolean | NO | false | Login succeeded |
| `attempt_time` | timestamptz | NO | now() | Attempt time |
| `ip_address` | text | YES | | Client IP |
| `user_agent` | text | YES | | Browser user agent |

---

### user_lockouts

Account lockout records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `user_id` | uuid | NO | | User ID |
| `locked_at` | timestamptz | NO | now() | Lock time |
| `unlock_at` | timestamptz | YES | | Scheduled unlock |
| `unlocked_at` | timestamptz | YES | | Actual unlock time |
| `unlocked_by` | uuid | YES | | Unlocked by user |
| `reason` | text | YES | | Lockout reason |

---

### user_password_history

Password change history.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `user_id` | uuid | NO | | User ID |
| `password_changed_at` | timestamptz | NO | now() | Change timestamp |
| `changed_by` | uuid | YES | | Changed by user |

---

### security_audit_logs

Security event logging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `user_id` | uuid | YES | | User ID |
| `property_id` | uuid | YES | | FK to properties |
| `event_type` | text | NO | | Event type |
| `event_description` | text | YES | | Event description |
| `ip_address` | text | YES | | Client IP |
| `user_agent` | text | YES | | Browser user agent |
| `metadata` | jsonb | YES | | Additional data |
| `created_at` | timestamptz | NO | now() | Event timestamp |

---

### staff_profiles

Staff user profiles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `user_id` | uuid | NO | | User ID (Supabase Auth) |
| `first_name` | text | NO | | First name |
| `last_name` | text | NO | | Last name |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### staff_activity_log

Staff activity tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `staff_id` | uuid | NO | | FK to staff_profiles |
| `action` | text | NO | | Action performed |
| `details` | jsonb | YES | | Action details |
| `created_at` | timestamptz | NO | now() | Action timestamp |

---

### api_keys

API key management.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `key_name` | text | NO | | Key name |
| `key_prefix` | text | NO | | Key prefix (for identification) |
| `key_hash` | text | NO | | Hashed key value |
| `key_type` | text | NO | 'standard' | Key type |
| `scopes` | jsonb | YES | | Allowed scopes |
| `rate_limit_per_minute` | integer | YES | 60 | Rate limit |
| `expires_at` | timestamptz | YES | | Expiration |
| `last_used_at` | timestamptz | YES | | Last usage |
| `revoked_at` | timestamptz | YES | | Revocation time |
| `is_active` | boolean | YES | true | Active |
| `created_by` | uuid | YES | | Created by user |
| `created_at` | timestamptz | YES | now() | Creation timestamp |

---

### api_logs

API request logging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `api_key_id` | uuid | YES | | FK to api_keys |
| `property_id` | uuid | YES | | FK to properties |
| `method` | text | NO | | HTTP method |
| `endpoint` | text | NO | | Endpoint path |
| `status_code` | integer | YES | | Response status |
| `response_time_ms` | integer | YES | | Response time |
| `request_body` | jsonb | YES | | Request payload |
| `error_message` | text | YES | | Error message |
| `ip_address` | text | YES | | Client IP |
| `user_agent` | text | YES | | User agent |
| `created_at` | timestamptz | YES | now() | Request timestamp |

---

## Group Block Tables

### group_blocks

Group reservation blocks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `city_ledger_account_id` | uuid | YES | | FK to ledger_accounts |
| `master_ledger_account_id` | uuid | YES | | FK to ledger_accounts |
| `code` | text | NO | | Block code |
| `description` | text | YES | | Description |
| `start_date` | date | NO | | Block start |
| `end_date` | date | NO | | Block end |
| `status` | text | YES | 'active' | Block status |
| `contact_first_name` | text | YES | | Contact first name |
| `contact_last_name` | text | YES | | Contact last name |
| `contact_email` | text | YES | | Contact email |
| `contact_phone` | text | YES | | Contact phone |
| `street_address` | text | YES | | Address |
| `city` | text | YES | | City |
| `state` | text | YES | | State |
| `zipcode` | text | YES | | Postal code |
| `country` | text | YES | | Country |
| `has_master_account` | boolean | YES | false | Has master billing |
| `allow_other_room_types` | boolean | YES | false | Allow non-blocked types |
| `allow_overbooking` | boolean | YES | false | Allow overbooking |
| `charge_routing` | text | YES | | Charge routing rule |
| `master_contact_name` | text | YES | | Master contact name |
| `master_contact_email` | text | YES | | Master contact email |
| `master_contact_phone` | text | YES | | Master contact phone |
| `created_at` | timestamptz | YES | now() | Creation timestamp |
| `updated_at` | timestamptz | YES | now() | Last update timestamp |

---

### group_block_room_allocations

Room allocations within group blocks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `group_block_id` | uuid | NO | | FK to group_blocks |
| `site_type_id` | uuid | YES | | FK to site_types |
| `site_id` | uuid | YES | | FK to sites |
| `rate_id` | uuid | YES | | FK to rates |
| `allocation_date` | date | NO | | Date of allocation |
| `rooms_blocked` | integer | NO | 1 | Number of rooms |
| `override_rate` | decimal(10,2) | YES | | Override rate |
| `created_at` | timestamptz | YES | now() | Creation timestamp |

---

### group_block_payment_cards

Payment cards for group blocks.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `group_block_id` | uuid | NO | | FK to group_blocks |
| `payment_card_id` | uuid | NO | | FK to payment_cards |
| `is_primary` | boolean | YES | false | Primary card |
| `created_at` | timestamptz | YES | now() | Creation timestamp |

---

## CRM & Marketing Tables

### campaigns

Marketing campaigns.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `name` | text | NO | | Campaign name |
| `trigger_type` | text | NO | 'manual' | Trigger type |
| `trigger_days` | integer | YES | | Days offset |
| `channel` | text | NO | 'email' | Channel |
| `subject` | text | YES | | Email subject |
| `content` | text | YES | | Message content |
| `segment_filters` | jsonb | YES | | Segment criteria |
| `status` | text | NO | 'draft' | Campaign status |
| `sent_count` | integer | YES | 0 | Times sent |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### campaign_sends

Campaign send records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `campaign_id` | uuid | NO | | FK to campaigns |
| `guest_id` | uuid | NO | | FK to guests |
| `reservation_id` | uuid | YES | | FK to reservations |
| `status` | text | NO | 'sent' | Send status |
| `sent_at` | timestamptz | NO | now() | Send timestamp |

---

## System & Audit Tables

### change_journal

Data change audit trail.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `record_type` | text | NO | | Entity type |
| `record_id` | uuid | NO | | Entity ID |
| `record_identifier` | text | NO | | Human-readable ID |
| `field_name` | text | NO | | Changed field |
| `old_value` | text | YES | | Previous value |
| `new_value` | text | YES | | New value |
| `changed_by` | uuid | YES | | Changed by user |
| `changed_by_name` | text | YES | | Changed by name |
| `created_at` | timestamptz | NO | now() | Change timestamp |

---

### auto_run_logs

Automated process logs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | YES | | FK to properties |
| `run_type` | text | NO | | Process type |
| `status` | text | NO | | Run status |
| `audit_date` | date | YES | | Audit date |
| `folios_processed` | integer | YES | | Folios processed |
| `total_room_revenue` | decimal(10,2) | YES | | Room revenue |
| `total_tax_revenue` | decimal(10,2) | YES | | Tax revenue |
| `message` | text | YES | | Status message |
| `created_at` | timestamptz | YES | now() | Run timestamp |

---

### property_confirmation_sequences

Confirmation number sequences.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `property_id` | uuid | NO | | PK, FK to properties |
| `last_number` | integer | NO | 0 | Last used number |

---

### subscriptions

Organization billing subscriptions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `organization_id` | uuid | NO | | FK to organizations (unique) |
| `billing_cycle` | text | NO | 'monthly' | Billing cycle |
| `price_per_site` | decimal(10,2) | NO | 0 | Price per room |
| `max_sites` | integer | NO | 100 | Max rooms |
| `suspended_at` | timestamptz | YES | | Suspension time |
| `suspension_reason` | text | YES | | Suspension reason |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

### ota_connections

OTA integration connections.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | uuid_generate_v4() | Primary key |
| `property_id` | uuid | NO | | FK to properties |
| `ota_name` | text | NO | | OTA name |
| `api_endpoint` | text | NO | | API endpoint URL |
| `api_key` | text | NO | | API key |
| `is_active` | boolean | NO | true | Active |
| `created_at` | timestamptz | NO | now() | Creation timestamp |
| `updated_at` | timestamptz | NO | now() | Last update timestamp |

---

## Database Functions

### can_access_guest

Check if a property can access a guest profile.

```sql
can_access_guest(_guest_id: uuid, _property_id: uuid) → boolean
```

### execute_readonly_query

Execute a read-only SQL query (for reporting).

```sql
execute_readonly_query(query_text: text) → jsonb
```

### has_role

Check if a user has a specific role.

```sql
has_role(_role: app_role, _user_id: uuid) → boolean
```

### is_org_admin

Check if the current user is an organization admin.

```sql
is_org_admin(_organization_id: uuid) → boolean
```

### is_super_admin

Check if the current user is a super admin.

```sql
is_super_admin() → boolean
```

### mark_occupied_rooms_dirty

Mark all occupied rooms as dirty for housekeeping.

```sql
mark_occupied_rooms_dirty(p_property_id: uuid) → void
```

### user_can_access_property / user_has_property_access

Check if the current user can access a property.

```sql
user_can_access_property(_property_id: uuid) → boolean
user_has_property_access(_property_id: uuid) → boolean
```

---

## Relationship Matrix

### Core Relationships

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| organizations | properties | 1:N | organization_id |
| organizations | property_groups | 1:N | organization_id |
| organizations | guests | 1:N | organization_id |
| organizations | subscriptions | 1:1 | organization_id |
| property_groups | properties | 1:N | property_group_id |
| properties | sites | 1:N | property_id |
| properties | site_types | 1:N | property_id |
| properties | reservations | 1:N | property_id |
| properties | rates | 1:N | property_id |
| properties | add_ons | 1:N | property_id |
| properties | accounts | 1:N | property_id |
| properties | ledger_accounts | 1:N | property_id |
| site_types | sites | 1:N | site_type_id |
| sites | reservations | 1:N | site_id |
| guests | reservations | 1:N | guest_id |
| rates | reservations | 1:N | rate_id |

### Accounting Relationships

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| account_groups | accounts | 1:N | account_group_id |
| ledger_accounts | folio_postings | 1:N | ledger_account_id |
| ledger_accounts | ledger_transactions | 1:N | ledger_account_id |
| accounts | folio_postings | 1:N | account_id |
| night_audits | folio_postings | 1:N | night_audit_id |
| journal_entries | journal_entry_lines | 1:N | journal_entry_id |

### Payment Relationships

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| payment_cards | payment_authorizations | 1:N | payment_card_id |
| payment_cards | payment_transactions | 1:N | payment_card_id |
| payment_authorizations | payment_transactions | 1:N | authorization_id |
| ledger_accounts | payment_authorizations | 1:N | ledger_account_id |

### Housekeeping Relationships

| Parent Table | Child Table | Relationship | Foreign Key |
|--------------|-------------|--------------|-------------|
| housekeeping_staff | housekeeping_assignments | 1:N | staff_id |
| housekeeping_zones | sites | 1:N | zone_id |
| sites | housekeeping_assignments | 1:N | site_id |
| site_types | room_type_cleaning_times | 1:1 | site_type_id |

---

## Index Summary

Key indexes for query performance:

| Table | Index | Columns |
|-------|-------|---------|
| reservations | idx_reservations_dates | check_in_date, check_out_date |
| reservations | idx_reservations_site | site_id |
| reservations | idx_reservations_property | property_id |
| sites | idx_sites_property | property_id |
| sites | idx_sites_type | site_type_id |
| folio_postings | idx_folio_postings_ledger | ledger_account_id |
| folio_postings | idx_folio_postings_date | posting_date |
| seasons | idx_seasons_dates | start_date, end_date |

---

## Data Integrity Features

### Automatic Timestamps

All tables include `created_at` and `updated_at` columns with automatic updates via triggers:

```sql
CREATE TRIGGER update_[table]_updated_at 
  BEFORE UPDATE ON [table] 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Row Level Security (RLS)

All tables have RLS enabled with policies for:
- Public read access for guest-facing data
- Authenticated access for operational data
- Property-level isolation for multi-tenancy

### Referential Integrity

All foreign keys are enforced with appropriate ON DELETE behaviors:
- `CASCADE` for child records that should be deleted with parent
- `SET NULL` for optional relationships
- `RESTRICT` for required relationships

---

*Document generated from Supabase types definition - 58 tables documented*

