import express from 'express';
import connDB from './config/db.js';
import dotenv from 'dotenv';
dotenv.config();
import bodyParser from 'body-parser';
import { notFound,errorHandler } from './middlewares/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import {handleWebhook} from './controllers/subscriptionController.js';
import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import cron from 'node-cron';
import {sendDailyActivityNotifications} from './utils/emailQueue.js'
import superAdminRoutes from './routes/superAdminRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js'
import path from 'path'
   
const app = express();

app.post("/api/webhooks/stripe", bodyParser.raw({ type: "application/json" }), handleWebhook);
 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
 
connDB();

app.get('/',(req,res)=>{
    res.send('MultiTanent App is Running')
});
 
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

app.use("/docs", express.static(path.join(process.cwd(), "docs")));
 
app.use('/api/auth',authRoutes);
app.use('/api/org',orgRoutes);
app.use('/api/users',userRoutes);
app.use('/api/clients',clientRoutes);
app.use('/api/activity',activityRoutes);
app.use('/api/superAdmin',superAdminRoutes);
app.use('/api/analytics',analyticsRoutes);

 
app.get("/payment/success", (req, res) => {
  res.status(200).json({ message: "Payment successful" });
});
   
app.get("/payment/cancel", (req, res) => {
  res.status(200).json({ message: "Payment cancelled" });
});   
 
app.post("/test-body", (req, res) => {
  console.log("Received body:", req.body);
  res.json({ received: req.body });
});  
 
// daily notif at 9 am if their is aNy Meeting that Day 
cron.schedule('* 9 * * *', sendDailyActivityNotifications, {
  timezone: 'Asia/Karachi' 
});
   
app.use(notFound);
app.use(errorHandler);
 
const PORT=process.env.PORT;
app.listen(PORT,()=>{
    console.log(`App is Runing on PORT ${PORT}`);
})
 
 