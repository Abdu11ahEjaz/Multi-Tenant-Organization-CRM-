import express from "express";
import { createOrg,updateOrg,deleteOrg,getOrg,getOrgs } from "../controllers/organizationController.js";
import upload from "../middlewares/multer.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";

const router = express.Router();

const uploadMiddleware = upload.single('logo');

router.use(authMiddleware);
router.use(roleMiddleware('SuperAdmin'));

router.post('/',uploadMiddleware,createOrg);

router.put('/:id',uploadMiddleware,updateOrg);

router.delete('/:id',deleteOrg);

router.get('/',getOrgs);

router.get('/:id',getOrg);

export default router;