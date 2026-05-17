import { Router } from "express";
import { healthRouter } from "./health";
import { companiesRouter } from "./companies";
import { contactsRouter } from "./contacts";
import { rfqsRouter } from "./rfqs";
import { quotesRouter } from "./quotes";
import { ratesRouter } from "./rates";
import { partnersRouter } from "./partners";
import { settingsRouter } from "./settings";
import { seedRouter } from "./seed";
import { gmailRouter } from "./gmail";
import { emailAccountsRouter } from "./email-accounts";
import { microsoftAuthRouter } from "./microsoft-auth";
import { googleAuthRouter } from "./google-auth";
import { emailSyncRouter } from "./email-sync";

const router = Router();

router.use(healthRouter);
router.use(companiesRouter);
router.use(contactsRouter);
router.use(rfqsRouter);
router.use(quotesRouter);
router.use(ratesRouter);
router.use(partnersRouter);
router.use(settingsRouter);
router.use(seedRouter);
router.use(gmailRouter);
router.use(emailAccountsRouter);
router.use(microsoftAuthRouter);
router.use(googleAuthRouter);
router.use(emailSyncRouter);

export default router;
