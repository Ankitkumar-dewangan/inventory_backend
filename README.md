# Premium FIFO Inventory Management System Backend

This is the production-ready backend for the **Premium Inventory Management System (FIFO)**. It is built using Node.js, Express, and Prisma ORM, and is pre-configured to work out-of-the-box with local PostgreSQL, falling back gracefully to an in-memory Event Broker if Apache Kafka is not present.

---

## 🚀 How to Setup and Run

### 1. Install Dependencies
Navigate to the `Backend` directory and run:
```bash
npm install
```

### 2. Configure Environment Variables
A `.env` file has been generated at the root of the `Backend` directory:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:ankit123@localhost:5432/inventory_db?schema=public"
JWT_SECRET="super-secret-inventory-key-998877"
JWT_EXPIRES_IN="7d"
KAFKA_BROKERS="localhost:9092"
KAFKA_CLIENT_ID="inventory-service"
KAFKA_ENABLED="false"
NODE_ENV="development"
```

### 3. Run Database Migrations
Synchronize your local PostgreSQL database schemas:
```bash
npx prisma migrate dev --name init
```

### 4. Seed the Database
Populate your database with the default users, products, active FIFO batches, and transaction histories matching the frontend mocks:
```bash
npm run seed
```
This seeds two test users:
*   **Admin**: `admin@example.com` (password: `password123`)
*   **Manager (User)**: `manager@example.com` (password: `password123`)

### 5. Start Development Server
```bash
npm run dev
```
The server will start on **`http://localhost:5000`**.

---

## ☁️ How to Connect to Supabase Later

Since Supabase is fully powered by PostgreSQL, you can easily point this backend to your Supabase project in the future.

### Steps:
1. Log in to your **Supabase Dashboard**.
2. Navigate to **Project Settings** > **Database**.
3. Under the **Connection String** section, copy the **URI** connection string (ensure it uses the transaction pooler on port `6543` or direct connection on port `5432`).
4. Update the `DATABASE_URL` in your `.env` file with the Supabase connection string. For example:
   ```env
   DATABASE_URL="postgres://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```
5. Apply the schemas directly to Supabase by running:
   ```bash
   npx prisma db push
   ```

---

## 📐 Project Architecture

```
backend/
├── prisma/
│   └── schema.prisma        # Database Tables (Users, Products, Batches, Sales, Events)
├── src/
│   ├── config/
│   │   ├── swagger.json     # Swagger API Specifications
│   │   └── settingsStore.json # JSON-persisted Settings (Company/Notifications)
│   ├── database/
│   │   ├── db.js            # Prisma client instantiation
│   │   └── seed.js          # DB seeding file
│   ├── controllers/         # API Endpoint controllers (Auth, Products, FIFO, Analytics, etc.)
│   ├── routes/              # Express Router definitions
│   ├── middleware/          # Security, Auth verification, Zod validation, Error Handling
│   ├── validators/          # Zod validation schemas
│   ├── utils/               # Winston Logging service
│   ├── kafka/
│   │   ├── kafka.js         # KafkaJS client & Mock Broker fallback handler
│   │   ├── simulator.js     # Event simulator CLI script
│   │   ├── producer/        # Event publisher
│   │   └── consumer/        # Event consumer daemon
│   └── fifo/
│       └── fifoEngine.js    # Atomic FIFO calculations & stock valuation recalculator
├── app.js                   # Express application setup
└── server.js                # Entry point
```

---

## ⚙️ FIFO Business Logic Engine (`fifoEngine.js`)

The FIFO (First-In, First-Out) engine runs inside atomic database transactions to guarantee correctness.

1.  **Purchase Intake**:
    *   Creates a new inventory batch with the given purchase quantity. The `remaining_quantity` is initially equal to the purchased quantity.
    *   Recalculates the product's overall `currentQuantity` (sum of remaining quantities of active batches) and `averageCost` (weighted average cost of remaining stock).
    *   Updates the product status (`in-stock`, `low-stock` [$\le 10$], or `out-of-stock`).
2.  **Sale Outtake**:
    *   Finds active inventory batches for the product, sorted by `purchaseDate` and `createdAt` ascending (ensuring the oldest batch is consumed first).
    *   Deducts quantity sequentially until the sale is fully satisfied.
    *   Calculates the exact Cost of Goods Sold (COGS) based on the unit cost of the consumed batches.
    *   Saves the sale transaction, writes audit logs, and updates product attributes.

---

## 🛡️ Key Security Features
*   **JWT Authentication**: Secure stateless token issuance and verification.
*   **Role-Based Security**: Access modifiers separating user/admin privileges (e.g. products creation).
*   **Rate Limiting**: Defends against brute force and DDoS attacks.
*   **Input Validation**: Powered by **Zod** schema constraints.
*   **Secure Hashing**: Password storage using `bcryptjs` salts.
*   **Helmet & CORS**: Hardens HTTP response headers and manages resource sharing safely.
