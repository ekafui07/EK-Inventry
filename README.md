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
- **👥 Client Directory**: Manage client profiles, production company affiliations, emails, and phone numbers.
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
│   ├── package.json              # Dependencies & scripts
│   └── test-double-booking.js    # Integration test suite for booking overlaps
├── frontend/
│   ├── index.html                # Main application interface
│   ├── app.js                    # Client state management & API interaction
│   └── style.css                 # Custom responsive stylesheet
└── README.md                     # Project documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Python 3](https://www.python.org/) (or any static HTTP file server)

### 1. Start the Backend API Server
Navigate to the `backend` directory and start the local server:
```bash
cd backend
npm install
npm start
```
> The API server will start at: `http://localhost:3000`

### 2. Launch the Frontend
In a separate terminal, serve the `frontend` directory:
```bash
cd frontend
python3 -m http.server 8080
```
> Access the web application at: `http://localhost:8080`

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/gear` | Retrieve list of all equipment |
| `POST` | `/api/gear` | Register new equipment item |
| `GET` | `/api/clients` | Retrieve all registered clients |
| `POST` | `/api/clients` | Register a new client profile |
| `GET` | `/api/bookings` | Retrieve all bookings with client & gear details |
| `POST` | `/api/bookings` | Create a new booking (with double-booking check) |
| `PUT` | `/api/bookings/:id/return` | Mark rented gear as returned |
| `PUT` | `/api/bookings/:id/cancel` | Cancel an existing booking |

---

## 🧪 Running Automated Tests

To test the double-booking validation and schedule overlap rejection:
```bash
cd backend
npm test
```

---

## ☁️ AWS Deployment Environment Variables

When deploying to AWS Lambda with DynamoDB, configure the following environment variables:
- `AWS_REGION`: Target AWS region (e.g., `us-east-1`)
- `GEAR_TABLE`: DynamoDB table for gear (default: `EK_Gear`)
- `CLIENTS_TABLE`: DynamoDB table for clients (default: `EK_Clients`)
- `BOOKINGS_TABLE`: DynamoDB table for bookings (default: `EK_Bookings`)
