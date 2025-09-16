import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';
import {getClientAnalytics,getActiveUsers,exportClients,exportActivities} from '../controllers/analyticsController.js';

const router = express.Router();

router.use(authMiddleware, roleMiddleware(['Owner', 'Admin']));
router.get('/clients', getClientAnalytics);
router.get('/users/active', getActiveUsers);
router.get('/clients/export', exportClients);
router.get('/activities/export', exportActivities);

export default router;