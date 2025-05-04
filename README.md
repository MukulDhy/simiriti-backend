🧠 Smiriti Backend API Documentation
Base URL: https://simiriti-backend.onrender.com
API Version: v1
Format: JSON
Auth: Bearer Token (JWT) for protected routes

📚 Table of Contents
Authentication Routes

User Routes

Device Routes

Reminder Routes

Common Headers & Error Format

Integration Tips

1. ✅ Authentication Routes
POST /api/auth/register
Description: Register a new user
Access: Public
Body:

json
Copy
Edit
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "yourStrongPassword"
}
Response:

json
Copy
Edit
{
  "token": "JWT_TOKEN_HERE",
  "user": { "id": "...", "name": "...", "email": "...", "role": "patient" }
}
POST /api/auth/login
Description: Login with email & password
Access: Public
Body:

json
Copy
Edit
{
  "email": "john@example.com",
  "password": "yourStrongPassword"
}
Response: Same as register

GET /api/auth/me
Description: Get logged-in user profile
Access: Protected (all roles)

PUT /api/auth/profile
Description: Update logged-in user’s profile
Access: Protected (all roles)
Body: (any editable user fields)

PUT /api/auth/password
Description: Change password
Access: Protected (all roles)
Body:

json
Copy
Edit
{
  "currentPassword": "old123",
  "newPassword": "newStrong123"
}
2. 👤 User Routes
GET /api/users/me
Description: Get profile of current user
Access: Protected

PUT /api/users/me
Description: Update profile
Access: Protected
Body: Same as /profile

POST /api/users/link-patient
Description: Link family to a patient
Access: Protected
Body:

json
Copy
Edit
{
  "patientId": "PATIENT_ID"
}
3. 📟 Device Routes
All endpoints require authentication.

POST /api/devices/
Access: patient only
Description: Register a device
Body:

json
Copy
Edit
{
  "name": "Band 1",
  "serial": "ESP32-XXXX"
}
GET /api/devices/
Access: patient
Description: Get all registered devices for the patient

GET /api/devices/:id
Access: patient
Description: Get specific device

PUT /api/devices/:id
Access: patient
Description: Update device info

DELETE /api/devices/:id
Access: patient
Description: Remove device

POST /api/devices/:id/ping
Access: patient, caregiver, family
Description: Send a ping to a device
Use case: Notify wearable from any authorized role

4. ⏰ Reminder Routes
All endpoints require authentication and roles: patient, family, or caregiver.

POST /api/reminders/
Description: Create a new reminder
Body:

json
Copy
Edit
{
  "title": "Take Medicine",
  "time": "2025-05-04T15:00:00Z"
}
GET /api/reminders/
Description: Get all reminders

GET /api/reminders/:id
Description: Get a single reminder by ID

PATCH /api/reminders/:id
Description: Update a reminder
Body: Same fields as create, partial allowed

DELETE /api/reminders/:id
Description: Cancel a reminder

5. 📎 Common Headers & Error Format
Authentication Header (Protected Routes)
makefile
Copy
Edit
Authorization: Bearer <JWT_TOKEN>
Error Format
json
Copy
Edit
{
  "success": false,
  "message": "Detailed error message here"
}
6. 🔧 Integration Tips
Login first using /api/auth/login to receive a JWT Token.

Store the JWT in frontend state (e.g., localStorage or secure cookie).

Send the token in all API calls needing auth using the Authorization header.

Devices and reminders are role-specific, ensure user roles are respected in your frontend logic.

Use GET /api/reminders/ and display upcoming alerts to the patient on the main screen.

Handle server errors gracefully using the standardized message field.

The server uses rate limiting, avoid repeated rapid requests.

🖧 Real-time Integration Notes
This backend supports WebSocket-based updates (websocket.service.js) and MQTT via mqtt.service.js.

Use WebSockets for real-time updates to device states and reminders.

MQTT is internally used for communication between backend and ESP32 devices.
