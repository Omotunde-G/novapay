const express = require("express");

const {createPayment, verifyPayment } = require("../controllers/paymentController")
const router = express.Router();

router.post ("/", createPayment)
router.get ("/verify/:reference", verifyPayment)

module.exports = router;