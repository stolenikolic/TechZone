# Tech Zone

Tech Zone is an electronics e-commerce platform that aggregates products from multiple suppliers.

## Goal

Build a centralized online store that automatically imports products from suppliers and displays the best available offer.

The system compares supplier products and merges them into a single master product shown to customers.

---

## Architecture

Frontend:
- Next.js (Bazaar template)
- Used only for UI rendering

Backend:
- Supabase (PostgreSQL)
- Custom product aggregation engine

---

## Core Concept

There are THREE product layers:

### 1. Master Products
Represents a real-world product.

Example:
ASUS ROG Gladius III Wireless

---

### 2. Supplier Products
Same product coming from different suppliers.

Example:
- IPON version
- Comtrade version

Each supplier product has its own:
- price
- stock
- supplier id

---

### 3. Matching System
Supplier products are matched to master products automatically or manually.

---

## Suppliers (Phase 1)

- IPON (API import)
- Comtrade (XML import)

---

## Admin Panel Purpose

Admin dashboard is used for:

- supplier synchronization
- manual product matching
- price monitoring
- stock monitoring

NOT marketplace sellers.

---

## Development Rules

- Bazaar UI must not contain business logic
- All product data comes from Supabase
- Matching logic lives in backend
- UI only renders API data

---

## MVP Goal

First milestone:

Display products from Supabase database inside Bazaar shop grid.

No checkout.
No payments.
No authentication required initially.