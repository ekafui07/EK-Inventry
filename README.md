# 🎬 EK GearFlow — Professional Media Rental Registry

**EK GearFlow** is a modern, full-stack media gear inventory and rental management system designed for production houses, camera rental houses, and creative studios. It enables real-time equipment tracking, client directory verification, financial performance analysis, invoice generation, and conflict-free rental scheduling with automated double-booking prevention.

🌐 **Live Production Deployment:** [https://dbjo34z68f2kg.cloudfront.net](https://dbjo34z68f2kg.cloudfront.net)

---

## 🌟 Key Features

- **📊 Operations Dashboard**: Real-time visibility into gear availability, active shoot rentals, maintenance items, revenue, and total registered clients.
- **📦 Master Gear Inventory**:
  - Track cameras, lighting, audio gear, and grip equipment with unique serial numbers and asset tags.
  - Set daily rental rates and track status (`Available`, `Rented`, `Maintenance`).
  - Search by equipment name, category, serial number, or asset tag.
- **📅 Smart Rental Scheduling & Conflict Prevention**:
  - Date-range booking workflow with automatic total rental cost calculation.
  - **Server-Side Double-Booking Protection**: Prevents scheduling conflicts by validating overlapping dates before confirming bookings.
  - Check-in / Return equipment and cancel bookings with automatic inventory status updates.
  - Flexible checkout with dynamic multi-item selection and granular removal.
- **👥 Client Directory & Compliance**: 
  - Manage client profiles, production company affiliations, emails, and phone numbers.
  - **Ghana Card & Guarantor Compliance**: Built-in verification for Ghana Card IDs and guarantor tracking to protect high-value equipment rentals.
- **🧾 Dedicated Invoice & Receipt Generator**:
  - Create custom rental receipts and commercial invoices for clients on demand.
  - Interactive itemization, tax/discount adjustments, and one-click **Print / Save as PDF** styling.
- **📈 Financial Analytics Dashboard**:
  - Track total revenue across all equipment categories.
  - Date range filtering and CSV data export capabilities.
- **🛡️ Root Audit Trail & Activity Logging**:
  - Comprehensive, tamper-resistant system audit log capturing user actions, timestamps, actor IDs, and operation categories.
- **☁️ Hybrid Deployment Architecture**:
  - **Zero-Config Local Development**: Powered by an offline JSON database (`db-mock.json`) — no database server required.
  - **AWS Serverless Cloud**: AWS Lambda (`serverless-http`), Amazon API Gateway, Amazon DynamoDB, S3 Static Hosting, and AWS CloudFront Global CDN.

---

## 🛠️ Technology Stack

### Frontend
- **Structure & Logic**: HTML5, Vanilla JavaScript (Modular ES6+ architecture in `frontend/js/`)
- **Styling**: Modern dark-mode responsive CSS with glassmorphism effects
- **Typography & Icons**: Google Fonts ([Outfit](https://fonts.google.com/specimen/Outfit)), [Lucide Icons](https://lucide.dev/)

### Backend & Cloud Infrastructure
- **Runtime & Framework**: Node.js, Express.js
- **Database Engine**:
  - **Local/Offline:** Embedded File Database (`backend/db-mock.json`) — zero external database server setup required.
  - **Cloud:** Amazon DynamoDB (5 on-demand pay-per-request tables).
- **AWS Services**: AWS Lambda, Amazon API Gateway, Amazon DynamoDB, Amazon S3, AWS CloudFront CDN.
- **Infrastructure as Code**: Serverless Framework (`serverless.yml`), AWS CloudFormation.
- **Security**: JWT Authentication, RBAC (Role-Based Access Control), bcrypt password hashing, input sanitization.

---

## 📁 Project Structure

```text
EK-Inventry/
├── backend/
│   ├── index.js                  # Express API entry point & AWS Lambda handler
│   ├── serverless.yml            # AWS CloudFormation & Infrastructure-as-Code blueprint
│   ├── deploy-frontend.js        # S3 asset uploader & CloudFront cache invalidator
│   ├── wipe-demo-data.js         # Production demo data purge & reset script
│   ├── seed-dynamodb.js          # Production database seeder
│   ├── db-mock.json              # Local zero-config mock database
│   ├── middleware/
│   │   └── auth.js               # JWT verification & RBAC permission checks
│   ├── src/
│   │   ├── config/               # Database and environment configuration
│   │   ├── controllers/          # API route controllers
│   │   ├── routes/               # Modular Express API domain routers
│   │   └── services/             # Core business logic (Gear, Clients, Bookings, Users, Audit)
│   ├── test-runner.js            # Unified 8-suite test harness
│   └── test-*.js                 # Automated contract & integration test suites
├── frontend/
│   ├── index.html                # Main application interface
│   ├── app.js                    # Core client state management & bootstrap
│   ├── style.css                 # Custom responsive stylesheet
│   └── js/                       # Domain-driven modular frontend scripts
│       ├── api.js                # API client & fetch wrappers
│       ├── audit.js              # Audit trail interface & filtering
│       ├── clients.js            # Client directory & validation logic
│       ├── inventory.js          # Gear inventory management
│       ├── invoice.js            # Dedicated invoice generator & PDF preview
│       ├── rentals.js            # Rental tracker & checkout workflow
│       ├── staff.js              # Staff accounts & permissions management
│       └── utils.js              # Formatting & helper utilities
├── SETUP_WINDOWS_NATIVE.md       # Standalone Native Windows PC installation guide
├── SETUP_WINDOWS_WSL2.md         # Standalone Windows + WSL2 (Ubuntu) installation guide
├── package.json                  # Root runner & deployment scripts
└── README.md                     # Project documentation
```

---

## 🚀 Quick Start Guide (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python 3](https://www.python.org/) (for local static frontend server)

---

### ⚡ One-Step Startup

Open your terminal in the root folder (`EK-Inventry/`) and run:

```bash
npm start
```

This single command automatically starts both local services concurrently:
1. ⚙️ **Backend API Server** &rarr; `http://localhost:3000`
2. 💻 **Frontend Web App** &rarr; `http://localhost:8080`

Open your browser and navigate to: **[http://localhost:8080](http://localhost:8080)**

---

### 🔄 Alternative: Running in Separate Terminals

1. **Terminal 1 (Backend API):**
   ```bash
   cd backend
   npm install
   npm start
   ```
   *(Running on `http://localhost:3000`)*

2. **Terminal 2 (Frontend App):**
   ```bash
   cd frontend
   python3 -m http.server 8080
   ```
   *(Running on `http://localhost:8080`)*

---

## 💻 Client PC Deployment & Auto-Start Setup

For permanent client workstation installations where the app should boot automatically when the PC turns on:

- 📄 **[Native Windows Setup Guide (SETUP_WINDOWS_NATIVE.md)](file:///wsl.localhost/Ubuntu/home/ekafui07/EK-Inventry/SETUP_WINDOWS_NATIVE.md):** Step-by-step instructions for standard Windows 10/11 machines using native Node.js, `launch.bat`, `start-silent.vbs`, and Windows Startup integration.
- 📄 **[Windows + WSL2 Ubuntu Setup Guide (SETUP_WINDOWS_WSL2.md)](file:///wsl.localhost/Ubuntu/home/ekafui07/EK-Inventry/SETUP_WINDOWS_WSL2.md):** Complete setup for running the Linux backend daemon inside WSL2 with seamless Windows desktop app integration.

---

## 🔑 Default Login Credentials

Sign in using one of the pre-configured accounts:

| Role | Email | Password | Permissions / Access |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@ekgearflow.com` | `admin123` | Full system access, add/edit/delete gear & clients, manage staff, finances |
| **Staff** | `sarah@ekgearflow.com` | `BerlinB1214@` | Rental management, client directory, equipment check-in/return, invoicing |
| **Admin (Test)** | `admin@gearflow.com` | `Admin@123` | Automated testing & system administrator account |
| **Staff (Test)** | `staff@gearflow.com` | `Staff@123` | Automated testing & desk specialist account |

> **💡 Changing or Resetting Passwords:**
> - **From the Web App:** Click **"Forgot Password?"** on the login screen, enter your email (`admin@ekgearflow.com`), and log in with the temporary default `12345`. The app will immediately prompt you to set your new custom password.
> - **In Code:** Default seed credentials are located in `backend/src/services/users.service.js` inside the `seedInitialUsers()` function.

---

## 💾 Local Database Architecture & Post-Setup Handover

### 1. How the Local Database Works
When running locally on a client machine, EK GearFlow uses an embedded JSON database located at:
📁 `backend/db-mock.json`

* **No DB Server Required:** There is no need to install or configure MongoDB, PostgreSQL, or DynamoDB locally.
* **Instant Persistence:** All equipment additions, client records, rentals, and invoices are automatically saved to `db-mock.json`.

---

### 2. Post-Setup Client Handover (Wiping Test Data)
After completing setup and testing on the client's PC, purge all test/dummy data to deliver a pristine system:

1. Open `backend/db-mock.json`.
2. Replace its content with the clean starter template:
   ```json
   {
     "gear": [],
     "clients": [],
     "bookings": [],
     "users": [
       {
         "id": "u1",
         "name": "Admin",
         "email": "admin@ekgearflow.com",
         "role": "admin",
         "accountType": "Admin",
         "status": "Active",
         "password": "admin123"
       },
       {
         "id": "u_sarah_ek",
         "name": "Sarah Adjei",
         "email": "sarah@ekgearflow.com",
         "role": "staff",
         "accountType": "Staff",
         "status": "Active",
         "password": "BerlinB1214@"
       }
     ],
     "auditLogs": []
   }
   ```
3. Save the file. When the client opens the app, all tables will start fresh at **0 records**, with admin login accounts intact and ready.

---

## ☁️ Deploying Changes to AWS CloudFront

Deploy updates directly from your terminal using the configured npm scripts:

### 1. Deploy Frontend Only (HTML, CSS, JS)
Uploads your latest frontend assets to the S3 bucket and **automatically invalidates the CloudFront CDN cache** so updates reflect globally within seconds:

```bash
npm run deploy:frontend
```
*(Or inside `backend/`: `npm run deploy:frontend`)*

### 2. Deploy Backend Only (APIs, Lambda, Database)
Updates AWS Lambda functions, API Gateway routes, and CloudFormation resources:

```bash
npm run deploy:backend
```
*(Or inside `backend/`: `npm run deploy:backend`)*

### 3. Deploy Full-Stack (Backend + Frontend + CloudFront)
Deploys backend cloud infrastructure first, then automatically uploads frontend assets and invalidates CloudFront:

```bash
npm run deploy
```
*(Or inside `backend/`: `npm run deploy`)*

---

## 🧹 Preparing Clean Data for a Cloud Demo (AWS DynamoDB)

### Scenario A: Purging Live AWS Cloud Data
To wipe all test gear, test clients, dummy rentals, and audit logs from AWS DynamoDB while **preserving your core admin and staff login accounts**:

```bash
cd backend
node wipe-demo-data.js --stage prod
```
*After running this, refresh your live CloudFront link ([https://dbjo34z68f2kg.cloudfront.net](https://dbjo34z68f2kg.cloudfront.net)) to start with a fresh, clean database.*

### Scenario B: Pre-Loading Catalog Gear to AWS (Optional)
If you want to sync curated catalog items from local `db-mock.json` up to AWS DynamoDB before a presentation:

```bash
cd backend
node seed-dynamodb.js --stage prod
```

---

## 🧪 Automated Testing & Pre-Push Guardrails

The project includes an 8-suite automated test harness that runs before every `git push` to protect against regressions:

```bash
npm test
```
*(Or inside `backend/`: `npm test`)*

### Test Suites Included:
1. **Phase 2: Concurrency & Lock Serialization** (Simultaneous checkout race condition testing)
2. **Phase 1: Security, XSS & Ban Enforcement** (XSS neutralization and instant token revocation)
3. **Root Admin Audit Trail & Category Filters** (Audit logging compliance)
4. **Double-Booking & Range Overlap Boundary Math** (Collision algorithms)
5. **Staff Lifecycle, Navigation & Privilege Escalation** (RBAC security)
6. **Authentication & RBAC Policy Protection** (Token permissions)
7. **Comprehensive Pre-Deployment Integration Suite** (Full lifecycle testing)
8. **Frontend Privacy, Form Resets & Invoice Checks** (DOM integrity, privacy validation)

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description | Access Level |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user & obtain JWT token | Public |
| `POST` | `/api/login` | Login alias (backward compatibility) | Public |
| `GET` | `/api/auth/me` | Retrieve profile of authenticated user | Authenticated |
| `GET` | `/api/gear` | Retrieve list of all equipment | Authenticated |
| `POST` | `/api/gear` | Register new equipment item | Admin |
| `PUT` | `/api/gear/:id` | Update equipment details | Admin |
| `DELETE` | `/api/gear/:id` | Remove equipment item | Admin |
| `GET` | `/api/clients` | Retrieve all registered clients | Authenticated |
| `POST` | `/api/clients` | Register a new client profile (requires Ghana Card) | Staff / Admin |
| `PUT` | `/api/clients/:id` | Update client profile | Staff / Admin |
| `DELETE` | `/api/clients/:id` | Delete client profile (blocked if active bookings exist) | Admin |
| `GET` | `/api/bookings` | Retrieve all bookings with details | Authenticated |
| `POST` | `/api/bookings` | Create new booking (conflict checked & lock-serialized) | Staff / Admin |
| `PUT` | `/api/bookings/:id/checkout` | Check out reserved booking | Staff / Admin |
| `PUT` | `/api/bookings/:id/return` | Mark rented gear as returned / checked in | Staff / Admin |
| `PUT` | `/api/bookings/:id/cancel` | Cancel an existing booking | Staff / Admin |
| `GET` | `/api/users` | List all system users | Admin |
| `POST` | `/api/users` | Register new user (Single Admin policy) | Admin |
| `PUT` | `/api/users/:id` | Update user profile | Admin or Self |
| `DELETE` | `/api/users/:id` | Remove user (prevents deleting last admin) | Admin |
| `POST` | `/api/users/:id/reset-password` | Reset user password to default | Admin |
| `POST` | `/api/users/:id/change-password` | Change user password | Authenticated |
| `PUT` | `/api/users/:id/status` | Activate or deactivate user (instant ban) | Admin |
| `GET` | `/api/audit-logs` | Retrieve tamper-resistant system audit history | Admin |
