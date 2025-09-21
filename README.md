# Multi-Tanent Organizational Management 

This is a secure, scalable backend system built with **Node.js**, **Express**, and **MongoDB**,**Cloudinary**,**Stripe** designed to manage users, clients, meetings, and activities, payments across organizations with strict role-based access control.

---

## Features

-  **Authentication & Authorization**
  - JWT-based login
  - Role-based access: SuperAdmin, Owner, Admin, Staff
-  **User Management**
  - SuperAdmin creates Owners and Organizations
  - Owner creates Admins
  - Admins manage Staff
  - Staff can only view assigned clients and activities
-  **Client & Meeting Management**
  - CRUD operations with access boundaries
  - Staff can only view assigned clients and meetings
-  **Analytics**
  - Active user tracking
  - Role-based activity aggregation
-  **File Uploads**
  - Attachments to activities with metadata stored to cloudinary 
-  **Payment Integration**
  - Stripe checkout for payment of pro and Enterprise plan  
-  **Modular Architecture**
  - Clean separation of controllers, models, routes, and middleware

---

##  Installation

- git clone https://github.com/Abdu11ahEjaz/Multi-Tenant-Organization-CRM-.git
- cd server
- npm install
- npm start



---

##  Environment Setup

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/your-db-name
JWT_SECRET=yourSecretKey ```

---

- [Postman Collection](./docs/postman_collection.json) available for manual testing
