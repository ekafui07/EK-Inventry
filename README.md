# 🎬 EK GearFlow — Professional Media Rental Registry

**EK GearFlow** is a full-stack media gear inventory and rental management system designed for production houses, camera rental houses, and creative studios. It enables real-time equipment tracking, client directory management, and conflict-free rental scheduling with automated double-booking prevention.

---

## 🌟 Key Features

- **📊 Operations Dashboard**: Real-time visibility into gear availability, active shoot rentals, maintenance items, and total registered clients.
- **📦 Master Gear Inventory**:
  - Track cameras, lighting, audio gear, and grip equipment with unique serial numbers.
  - Set daily rental rates and track status (`Available`, `Rented`, `Maintenance`).
  - Search by equipment name, category, or serial number.
- **📅 Smart Rental Scheduling & Conflict Prevention**:
  - Date-range booking workflow with automatic total rental cost calculation.
  - **Server-Side Double-Booking Protection**: Prevents scheduling conflicts by validating overlapping dates before confirming bookings.
  - Check-in / Return equipment and cancel bookings with automatic status updates.
  - Flexible checkout with dynamic multi-item selection and granular removal.
- **👥 Client & Staff Management**: 
  - Manage client profiles, production company affiliations, emails, and phone numbers.
  - **Enhanced Security**: Master admin isolation, self-edit locking, and real-time profile synchronization.
- **🛡️ System Audit Trail**: Comprehensive activity logging accessible to all administrative roles.
- **☁️ Hybrid Deployment Ready**:
  - **Local Development**: Runs with Node.js/Express and an offline JSON file database (`db-mock.json`).
  - **AWS Serverless**: Ready for AWS Lambda (`serverless-http`) backed by Amazon DynamoDB tables (`EK_Gear`, `EK_Clients`, `EK_Bookings`).
  - **Frontend Offline Fallback**: Automatically switches to LocalStorage mock mode if the backend API is unreachable.

---

## 🛠️ Technology Stack

### Frontend
- **Structure & Logic**: HTML5, Vanilla JavaScript (ES6+)
- **Styling**: Modern dark-mode responsive CSS with glassmorphism effects
- **Typography & Icons**: Google Fonts ([Outfit](https://fonts.google.com/specimen/Outfit)), [Lucide Icons](https://lucide.dev/)

### Backend
- **Runtime & Framework**: Node.js, Express.js
- **AWS Integration**: AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`), `serverless-http`
- **Testing**: Automated integration test suite for double-booking conflict validation

---

## 📁 Project Structure

```text
EK-Inventry/
├── backend/
│   ├── index.js                  # Express API & AWS Lambda handler
│   ├── db-mock.json              # Local mock database for offline development
│   ├── middleware/
│   │   └── auth.js               # JWT verification & RBAC permission checks
│   ├── package.json              # Backend dependencies & scripts
│   ├── test-double-booking.js    # Integration test suite for booking overlaps
│   └── test-auth-rbac.js         # Integration test suite for Auth & RBAC
├── frontend/
│   ├── index.html                # Main application interface
│   ├── app.js                    # Client state management & API interaction
│   └── style.css                 # Custom responsive stylesheet with glassmorphism
├── package.json                  # Root runner script (concurrent execution)
└── README.md                     # Project documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Python 3](https://www.python.org/) (for static web hosting)

---

### ⚡ The Command That Works Every Time (One-Step Startup)

Open your terminal in the root folder (`EK-Inventry/`) and run:

```bash
npm start
```

**That's it!** This single command automatically starts both services concurrently:
1. ⚙️ **Backend API Server** &rarr; `http://localhost:3000`
2. 💻 **Frontend Web App** &rarr; `http://localhost:8080`

Open your browser and navigate to:
### 👉 **[http://localhost:8080](http://localhost:8080)**

---

### 🔄 Alternative: Running in Separate Terminals

If you prefer running the backend and frontend independently:

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

### 3. Default Login Credentials
Sign in using one of the pre-configured accounts:

| Role | Email | Password | Permissions / Access |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@ekgearflow.com` | `admin123` | Full system access, add/edit/delete gear & clients, manage staff |
| **Staff** | `sarah@ekgearflow.com` | `BerlinB1214@` | Rental management, client directory, equipment check-in/return |
| **Admin (Test)** | `admin@gearflow.com` | `Admin@123` | Automated testing & system administrator account |
| **Staff (Test)** | `staff@gearflow.com` | `Staff@123` | Automated testing & desk specialist account |

> **💡 Changing or Resetting the Admin Password:**
> - **From the Web App:** Click **"Forgot Password?"** on the login screen, enter your email (`admin@ekgearflow.com`), and log in with the temporary default `12345`. The app will immediately display the password update prompt allowing you to set your custom password.
> - **In Code:** Default seed credentials are located in `backend/index.js` inside the `seedInitialUsers()` function.

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
| `POST` | `/api/clients` | Register a new client profile | Staff / Admin |
| `PUT` | `/api/clients/:id` | Update client profile | Staff / Admin |
| `DELETE` | `/api/clients/:id` | Delete client profile | Admin |
| `GET` | `/api/bookings` | Retrieve all bookings with details | Authenticated |
| `POST` | `/api/bookings` | Create new booking (conflict checked) | Staff / Admin |
| `PUT` | `/api/bookings/:id/return` | Mark rented gear as returned | Staff / Admin |
| `PUT` | `/api/bookings/:id/cancel` | Cancel an existing booking | Staff / Admin |
| `GET` | `/api/users` | List all system users | Admin |
| `POST` | `/api/users` | Register new user (Single Admin policy) | Admin |
| `PUT` | `/api/users/:id` | Update user profile | Admin or Self |
| `DELETE` | `/api/users/:id` | Remove user (prevents deleting last admin) | Admin |
| `POST` | `/api/users/:id/reset-password` | Reset user password to default | Admin |
| `POST` | `/api/users/:id/change-password` | Change user password | Authenticated |
| `PUT` | `/api/users/:id/status` | Activate or deactivate user | Admin |

---

## 🧪 Running Automated Tests

Run the test suites in the `backend` directory:

```bash
cd backend
npm test         # Double-booking conflict validation suite
npm run test:rbac # Auth & RBAC integration test suite
npm run test:all  # Run all test suites
```

---

## ☁️ AWS Deployment Environment Variables

When deploying to AWS Lambda with DynamoDB, configure the following environment variables:
- `AWS_REGION`: Target AWS region (e.g., `us-east-1`)
- `GEAR_TABLE`: DynamoDB table for gear (default: `EK_Gear`)
- `CLIENTS_TABLE`: DynamoDB table for clients (default: `EK_Clients`)
- `BOOKINGS_TABLE`: DynamoDB table for bookings (default: `EK_Bookings`)
