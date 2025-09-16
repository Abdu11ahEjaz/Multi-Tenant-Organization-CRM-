import express from 'express';
import { createUser,updateUser,deleteUser,getUser,getUsers } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';
import multer from 'multer';
const upload = multer();

const router = express.Router();


router.use(authMiddleware);

router.post('/', roleMiddleware(['SuperAdmin','Admin', 'Owner']), createUser);
router.get('/', roleMiddleware(['Admin', 'Owner']), getUsers);
router.get('/:id', roleMiddleware(['Admin', 'Owner']), getUser);
router.put('/:id', roleMiddleware(['SuperAdmin','Admin', 'Owner']), upload.none(), updateUser);
router.delete('/:id', roleMiddleware(['Owner']), deleteUser);

export default router;