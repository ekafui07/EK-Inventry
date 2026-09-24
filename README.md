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
│   ├── index.js                       # Express API entry point & AWS Lambda handler
│   ├── serverless.yml                 # AWS infrastructure blueprint
│   ├── deploy-frontend.js             # S3 uploader & CloudFront cache invalidator
│   ├── db-mock.json                   # Local JSON database
│   ├── seed-rentdecam-mock.js         # LOCAL: reset db-mock.json with demo gear + clients
│   ├── wipe-local-data.js             # LOCAL: empty db-mock.json
│   ├── rentdecam-formatted-gear.json  # Demo gear catalog (131 items)
│   ├── rentdecam-clients.json         # Demo clients (3)
│   ├── seed-dynamodb.js               # AWS: upload db-mock.json data to DynamoDB
│   ├── wipe-demo-data.js              # AWS: wipe demo data from DynamoDB
│   ├── middleware/auth.js             # JWT verification & permission checks
│   ├── src/                           # config, controllers, routes, services
│   ├── test-runner.js                 # Runs all 8 test suites
│   └── test-*.js                      # Test suites
├── frontend/
│   ├── index.html, app.js, style.css
│   └── js/                            # api, audit, clients, inventory, invoice, rentals, staff, utils
├── SETUP_WINDOWS_NATIVE.md            # Windows PC install guide
├── SETUP_WINDOWS_WSL2.md              # Windows + WSL2 install guide
└── package.json                       # Root runner & deploy shortcuts
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

- 📄 **[Native Windows Setup Guide (SETUP_WINDOWS_NATIVE.md)](SETUP_WINDOWS_NATIVE.md):** Step-by-step instructions for standard Windows 10/11 machines using native Node.js, `launch.bat`, `start-silent.vbs`, and Windows Startup integration.
- 📄 **[Windows + WSL2 Ubuntu Setup Guide (SETUP_WINDOWS_WSL2.md)](SETUP_WINDOWS_WSL2.md):** Complete setup for running the Linux backend daemon inside WSL2 with seamless Windows desktop app integration.

---

## 🔑 Default Login Credentials

Sign in using one of the pre-configured accounts:

| Role | Email | Password | Permissions / Access |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@ekgearflow.com` | `admin123` | Full system access, add/edit/delete gear & clients, manage staff, finances |
| **Staff** | `sarah@ekgearflow.com` | *(set in `seedInitialUsers()`)* | Rental management, client directory, equipment check-in/return, invoicing |
| **Admin (Test)** | `admin@gearflow.com` | `Admin@123` | Automated testing & system administrator account |
| **Staff (Test)** | `staff@gearflow.com` | `Staff@123` | Automated testing & desk specialist account |

> **💡 Changing or Resetting Passwords:**
> - **From the Web App:** Click **"Forgot Password?"** on the login screen, enter your email (`admin@ekgearflow.com`), and log in with the temporary default `12345`. The app will immediately prompt you to set your new custom password.
> - **In Code:** Default seed credentials are located in `backend/src/services/users.service.js` inside the `seedInitialUsers()` function.

---

## 💾 Database Scripts (Load & Wipe Demo Data)

The app stores data in one of two places. Each has its own scripts. **Run all commands from the `backend/` folder** (`cd backend`).

| I want to... | Target | Command |
| :--- | :--- | :--- |
| **Load demo data** | Local (`db-mock.json`) | `node seed-rentdecam-mock.js` |
| **Wipe everything** | Local (`db-mock.json`) | `node wipe-local-data.js` |
| **Load demo data** | AWS DynamoDB | `node seed-dynamodb.js --stage prod` |
| **Wipe demo data** | AWS DynamoDB | `node wipe-demo-data.js --stage prod` |

> Stop the backend before running a local script, then start it again.

### Load demo data: local

```bash
node seed-rentdecam-mock.js
```

| Effect | Result |
| :--- | :--- |
| Gear | Replaced with the 131 items from `rentdecam-formatted-gear.json` |
| Clients | Replaced with the 3 demo clients |
| Bookings | Emptied |
| Audit logs | Reset to one "inventory initialized" entry |
| Users | **Kept.** The four default accounts are created only if the file has no users |
| Backup | Old file saved to `db-mock.backup.json` (overwritten on every run) |

Undo: copy `db-mock.backup.json` over `db-mock.json`.

### Wipe all data: local

```bash
node wipe-local-data.js               # empty everything, including users
node wipe-local-data.js --keep-users  # empty everything except users
```

| Effect | Result |
| :--- | :--- |
| Gear, clients, bookings, audit logs | Emptied |
| Users | Deleted, or kept with `--keep-users`. Without the flag, the four default accounts are recreated when the backend next starts |
| Backup | Old file saved to `db-mock.backup.json` (overwritten on every run) |

### Load demo data: AWS

```bash
node seed-dynamodb.js --stage prod
```

Copies gear, clients, bookings and users from your local `db-mock.json` up to DynamoDB. **Add-only:** items whose ID or email already exist in AWS are skipped. Nothing is overwritten or deleted. Audit logs are not copied.

### Wipe demo data: AWS

```bash
node wipe-demo-data.js --stage prod
```

| Table | Result |
| :--- | :--- |
| Gear, Clients, Bookings, Audit logs | **All items deleted** |
| Users | All deleted **except** `admin@ekgearflow.com`, `admin@gearflow.com`, `staff@gearflow.com` |

> ⚠️ **This deletes live data with no confirmation prompt and defaults to `--stage prod`.** It does not touch your local file. `sarah@ekgearflow.com` is not in the keep-list and is deleted, but the app recreates her with the default password the next time the backend starts.

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

## 🧪 Automated Testing & Pre-Push Guardrails

The project includes an 8-suite automated test harness that runs before every `git push` to protect against regressions:

```bash
npm test
```
*(Or inside `backend/`: `npm test`)*

> **Note:** Suite 8 relies on the demo data committed in `backend/db-mock.json`. If you ran a seed or wipe script locally, restore it first with `git checkout backend/db-mock.json`, otherwise `npm test` fails (and `npm run deploy` is blocked, because it runs the tests first).

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

Admins have every permission. Staff accounts only get the permissions assigned to them.

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` (alias `/api/login`) | Log in and get a JWT | Public |
| `POST` | `/api/forgot-password` | Reset password to the temporary default | Public |
| `GET` | `/api/auth/me` (alias `/api/me`) | Profile of the logged-in user | Logged in |
| `GET` | `/api/gear` | List all equipment | Logged in |
| `POST` | `/api/gear` | Add equipment | `manage_gear` |
| `PUT` | `/api/gear/:id` | Update equipment | `manage_gear` or `override_status` |
| `DELETE` | `/api/gear/:id` | Delete equipment | `manage_gear` |
| `GET` | `/api/clients` | List all clients | Logged in |
| `POST` | `/api/clients` | Add client (Ghana Card required) | `manage_clients` |
| `PUT` | `/api/clients/:id` | Update client | `manage_clients` |
| `DELETE` | `/api/clients/:id` | Delete client (blocked if active bookings) | `manage_clients` |
| `GET` | `/api/bookings` | List all bookings | Logged in |
| `POST` | `/api/bookings` | Create booking (conflict-checked) | `create_rentals` |
| `PUT` | `/api/bookings/:id/checkout` | Check out a reserved booking | `create_rentals` |
| `PUT` | `/api/bookings/:id/return` | Check equipment back in | `return_rentals` |
| `PUT` | `/api/bookings/:id/cancel` | Cancel a booking | `cancel_rentals` or `return_rentals` |
| `GET` | `/api/users` | List users | Admin |
| `POST` | `/api/users` | Create user | Admin |
| `PUT` | `/api/users/:id` | Update user | Admin or self |
| `DELETE` | `/api/users/:id` | Delete user (last admin protected) | Admin |
| `POST` | `/api/users/:id/reset-password` | Reset password to default | Admin |
| `POST` | `/api/users/:id/change-password` | Change password | Logged in |
| `PUT` | `/api/users/:id/status` | Activate / deactivate user | Admin |
| `GET` | `/api/audit-logs` | View audit history | Admin |
| `POST` | `/api/audit-logs/log` | Record an audit entry | Logged in |
