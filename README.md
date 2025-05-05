# 🧠 Smiriti Backend API

> Base URL: **https://simiriti-backend.onrender.com**  
> API Version: **v1**  
> Format: **JSON**  
> Authentication: **Bearer Token (JWT)** for protected routes

---

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication)
  - [User Management](#user-management)
  - [Device Management](#device-management)
  - [Reminders](#reminders)
  - [Real-time Communication](#real-time-communication)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

---

## 🔍 Overview

The **Smiriti Backend API** serves as the core of the Smiriti application, managing user authentication, device registration, reminder scheduling, and real-time communications. Built with **Node.js** and **Express**, it ensures secure and efficient operations for all backend functionalities.

---

## ✨ Features

- **User Authentication**: Secure registration and login using JWT.
- **Device Management**: Register, update, and monitor devices.
- **Reminder Scheduling**: Create, update, and manage reminders.
- **Real-time Communication**: WebSocket and MQTT support for instant updates.
- **Role-Based Access Control**: Permissions tailored for patients, caregivers, and family members.
- **Rate Limiting**: Protects against abuse by limiting repeated requests.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v14 or above)
- **npm** (v6 or above)
- **MongoDB** (Ensure MongoDB is running)

### Installation

Clone the repository:
```bash
git clone https://github.com/yourusername/smiriti-backend.git
cd smiriti-backend
```

Install dependencies:
```bash
npm install
```

Configure environment variables:  
Create a `.env` file in the root directory and add the following:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Run the server:
```bash
npm start
```

The server should now be running at `http://localhost:5000`.

---

## 📡 API Endpoints

### 🔐 Authentication

#### POST /api/auth/register
Register a new user.

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "yourStrongPassword"
}
```

#### POST /api/auth/login
Authenticate user and retrieve token.

```json
{
  "email": "john@example.com",
  "password": "yourStrongPassword"
}
```

#### GET /api/auth/me
Retrieve current user's profile.  
**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

#### PUT /api/auth/profile
Update user profile.  
**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

#### PUT /api/auth/password
Change user password.

```json
{
  "currentPassword": "oldPassword",
  "newPassword": "newStrongPassword"
}
```

---

### 👤 User Management

#### GET /api/users/me
Retrieve current user's profile.  
**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

#### PUT /api/users/me
Update current user's profile.  
**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

#### POST /api/users/link-patient
Link a family member to a patient.

```json
{
  "patientId": "patient_user_id"
}
```

---

### 📱 Device Management

> All device routes are protected.

#### POST /api/devices/
Register a new device.

```json
{
  "name": "Device Name",
  "serial": "Device Serial Number"
}
```

#### GET /api/devices/
Retrieve all devices.

#### GET /api/devices/:id
Retrieve a specific device by ID.

#### PUT /api/devices/:id
Update device information.

#### DELETE /api/devices/:id
Remove a device.

#### POST /api/devices/:id/ping
Send a ping to a device.

**All routes require:**
```
Authorization: Bearer <JWT_TOKEN>
```

---

### ⏰ Reminders

> All reminder routes are protected.

#### POST /api/reminders/
Create a new reminder.

```json
{
  "title": "Take Medicine",
  "time": "2025-05-04T15:00:00Z"
}
```

#### GET /api/reminders/
Retrieve all reminders.

#### GET /api/reminders/:id
Retrieve a specific reminder.

#### PATCH /api/reminders/:id
Update a reminder.

#### DELETE /api/reminders/:id
Cancel a reminder.

**All routes require:**
```
Authorization: Bearer <JWT_TOKEN>
```

---

### 🔁 Real-time Communication

The backend supports:

- **WebSockets**: Instant updates & notifications
- **MQTT**: Efficient ESP32 communication

---

## ❗ Error Handling

All errors follow this format:
```json
{
  "success": false,
  "message": "Detailed error message here"
}
```

Common HTTP codes:

- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

---

## 🤝 Contributing

1. Fork the repo
2. Create a new branch: `git checkout -b feature/YourFeature`
3. Commit changes: `git commit -m 'Add YourFeature'`
4. Push to the branch: `git push origin feature/YourFeature`
5. Open a pull request

---

## 📄 License

Licensed under the **MIT License**
