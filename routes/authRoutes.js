import express from "express";
import { login, register } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { roleMiddleware } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.post("/superadmin/register", register);

router.post(
  "/owner/register",
  authMiddleware,
  roleMiddleware(["SuperAdmin"]),
  register
);

router.post("/login", login);

export default router;
