import express from 'express';
import  {authMiddleware }  from '../middlewares/authMiddleware.js';
import { roleMiddleware }  from '../middlewares/roleMiddleware.js';
import * as superadminController from '../controllers/superAdminController.js'

const router = express.Router();

router.use(authMiddleware, roleMiddleware(['SuperAdmin']));
router.get('/dashboard', superadminController.getDashboard);

export default router;