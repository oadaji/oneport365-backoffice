import { Router } from "express";
import { healthRouter } from "./health";
import { companiesRouter } from "./companies";
import { contactsRouter } from "./contacts";
import { rfqsRouter } from "./rfqs";
import { quotesRouter } from "./quotes";
import { ratesRouter } from "./rates";
import { partnersRouter } from "./partners";
import { settingsRouter } from "./settings";

const router = Router();

router.use(healthRouter);
router.use(companiesRouter);
router.use(contactsRouter);
router.use(rfqsRouter);
router.use(quotesRouter);
router.use(ratesRouter);
router.use(partnersRouter);
router.use(settingsRouter);

export default router;
