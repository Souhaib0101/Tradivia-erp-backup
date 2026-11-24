import {Router} from 'express';import * as c from './invoice.controller.js';export const invoiceRoutes=Router();invoiceRoutes.get('/',c.list);invoiceRoutes.post('/',c.create);
