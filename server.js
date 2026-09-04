const express = require("express");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const pool = require("./server/db/database");

const app = express();

const PORT = process.env.PORT || 3000;

const billingRoutes = require("./server/routes/billingRoutes");
const paymentRoutes = require("./server/routes/paymentRoutes");

app.use(
  express.json({ verify: (req, res, buf) => { req.rawBody = buf; }, }),
);

app.use(express.urlencoded({ extended: true }));

app.use("/api/billing", billingRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/payment/callback", (req, res) => {
  const reference = req.query.reference;

  console.log("Paystack callback reference:", reference);

  if (!reference) {
    return res.redirect("/?payment=missing-reference");
  }

  res.redirect(
    `/?payment_reference=${encodeURIComponent(reference)}`
  );
});


app.post("/api/payments/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];

    if (!signature) {
      return res.status(401).json({
        error: "Missing Paystack signature",
      });
    }

    const hash = crypto
      .createHmac(
        "sha512",
        process.env.PAYSTACK_SECRET_KEY
      )
      .update(req.rawBody)
      .digest("hex");

    if (hash !== signature) {
      console.warn("Invalid Paystack webhook signature");

      return res.status(401).json({
        error: "Invalid signature",
      });
    }

    const event = req.body;

  
    if (event.event !== "charge.success") {
      return res.status(200).json({
        received: true,
      });
    }

    const reference = event.data?.reference;

    if (!reference) {
      console.warn(
        "Webhook has no transaction reference"
      );

      return res.status(400).json({
        error: "Transaction reference missing",
      });
    }

    console.log(
      "Paystack webhook received:",
      event.event,
      reference
    );

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

  
      const attemptResult = await client.query(
        `
        SELECT
          id,
          customer_id,
          invoice_id,
          provider,
          provider_reference,
          amount,
          currency,
          status
        FROM payment_attempts
        WHERE provider = 'paystack'
          AND provider_reference = $1
        LIMIT 1
        FOR UPDATE
        `,
        [reference]
      );

      if (attemptResult.rows.length === 0) {
        await client.query("ROLLBACK");

        console.warn(
          "No payment attempt found for webhook reference:",
          reference
        );

        return res.status(200).json({
          received: true,
          processed: false,
          message: "Payment attempt not found",
        });
      }

      const paymentAttempt =
        attemptResult.rows[0];

  
      if (
        paymentAttempt.status === "successful"
      ) {
        await client.query("COMMIT");

        console.log(
          "Webhook already processed:",
          reference
        );

        return res.status(200).json({
          received: true,
          processed: true,
          alreadyProcessed: true,
        });
      }

  
      const webhookAmount =
        Number(event.data.amount) / 100;

      const expectedAmount =
        Number(paymentAttempt.amount);

      if (webhookAmount !== expectedAmount) {
        await client.query("ROLLBACK");

        console.warn(
          "Webhook amount mismatch:",
          {
            reference,
            webhookAmount,
            expectedAmount,
          }
        );

        return res.status(400).json({
          error: "Payment amount mismatch",
        });
      }


      const webhookCurrency =
        String(
          event.data.currency || ""
        ).toUpperCase();

      const expectedCurrency =
        String(
          paymentAttempt.currency || ""
        ).toUpperCase();

      if (
        webhookCurrency !== expectedCurrency
      ) {
        await client.query("ROLLBACK");

        console.warn(
          "Webhook currency mismatch:",
          {
            reference,
            webhookCurrency,
            expectedCurrency,
          }
        );

        return res.status(400).json({
          error: "Payment currency mismatch",
        });
      }

  
      await client.query(
        `
        UPDATE payment_attempts
        SET
          status = 'successful',
          updated_at = NOW()
        WHERE id = $1
        `,
        [paymentAttempt.id]
      );


      const transactionResult =
        await client.query(
          `
          SELECT id
          FROM transactions
          WHERE provider = 'paystack'
            AND provider_reference = $1
          LIMIT 1
          `,
          [reference]
        );

    
      if (
        transactionResult.rows.length === 0
      ) {
        await client.query(
          `
          INSERT INTO transactions (
            customer_id,
            invoice_id,
            provider,
            provider_reference,
            amount,
            currency,
            status
          )
          VALUES (
            $1,
            $2,
            'paystack',
            $3,
            $4,
            $5,
            'successful'
          )
          `,
          [
            paymentAttempt.customer_id,
            paymentAttempt.invoice_id,
            reference,
            paymentAttempt.amount,
            paymentAttempt.currency,
          ]
        );
      }

      if (paymentAttempt.invoice_id) {
        await client.query(
          `
          UPDATE invoices
          SET
            status = 'paid',
            updated_at = NOW()
          WHERE id = $1
            AND status <> 'paid'
          `,
          [paymentAttempt.invoice_id]
        );
      }

      await client.query("COMMIT");

      console.log(
        "Paystack webhook processed successfully:",
        reference
      );

      return res.status(200).json({
        received: true,
        processed: true,
        reference,
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Webhook database processing error:",
        error
      );

      return res.status(500).json({
        error: "Webhook processing failed",
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error(
      "Paystack webhook error:",
      error
    );

    return res.status(500).json({
      error: "Webhook processing failed",
    });
  }
});

app.use( express.static( path.join(__dirname, "public"))
);

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    res.json({
      status: "ok",
      database: "connected",
      serverTime:
        result.rows[0].current_time,
    });

  } catch (error) {
    console.error(
      "Database health check failed:",
      error
    );

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

app.listen(PORT, () => {
  console.log( `NovaPay running at http://localhost:${PORT}`);
});