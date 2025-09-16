import express from "express";
import {
  createActivity,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
} from "../controllers/activityController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";
import upload from "../middlewares/multer.js";
const router = express.Router();

router.use(authMiddleware);

const uploadMiddleware = upload.array("files", 10); 

router.post( "/", roleMiddleware(["Admin", "Owner"]), uploadMiddleware,createActivity );
router.get('/',roleMiddleware(["Admin","Client","Staff"]),getActivities);
router.get('/:id',roleMiddleware(["Admin","Client","Staff"]),getActivity);
router.put('/:id',roleMiddleware(["Admin"]),updateActivity);
router.delete('/:id',roleMiddleware(["Admin"]),deleteActivity);

export default router;