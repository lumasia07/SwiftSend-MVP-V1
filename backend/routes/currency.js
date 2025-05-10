import express from "express";
import syncStellarAssets from "../src/currencyController.js";

const router = express.Router();

router.get('/sync-stellar-assets', syncStellarAssets);

const currencyRoutes = router;
export default currencyRoutes;
