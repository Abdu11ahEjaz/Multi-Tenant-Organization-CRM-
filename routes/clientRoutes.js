import express from 'express';
import {createClient, deleteClient, getClientById, getClients, updateClient} from '../controllers/clientController.js'
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';
import multer from 'multer';
const upload = multer();

const router = express.Router();

router.use(authMiddleware);

router.post('/', roleMiddleware(['SuperAdmin','Admin', 'Owner']),upload.none(), createClient);
router.get('/',roleMiddleware(['Admin','SuperAdmin','Owner']),getClients);
router.get('/:id',roleMiddleware(['Admin','SuperAdmin','Owner']),getClientById);
router.put('/:id',roleMiddleware(['Owner','Admin']),upload.none(),updateClient);
router.delete('/:id',roleMiddleware(['Owner','Admin']),deleteClient);


export default router;
