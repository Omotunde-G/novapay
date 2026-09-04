const express = require("express");

const {
    getBillingOverview
} = require("../controllers/billingController");

const router = express.Router();

router.get(
    "/overview",
    getBillingOverview
);

module.exports = router;