const pool = require("../db/database");

async function createPayment(req, res){const client = await pool.connect();

    try {
        const { invoiceId } = req.body;

        if (!invoiceId) { 
            return res.status(400).json({error: "Invoice ID is required"}); }

        const invoiceResult = await client.query(
            `
            SELECT
                id,
                customer_id,
                invoice_number,
                currency,
                total,
                status
            FROM invoices
            WHERE id = $1
            LIMIT 1
            `,
            [invoiceId]
        );

        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: "Invoice not found"});
        }

        const invoice = invoiceResult.rows[0];

        if (
            invoice.status !== "open" &&
            invoice.status !== "overdue"
        ) {
            return res.status(400).json({ error: "This invoice cannot be paid."});
        }

        const customerResult = await client.query(
            `
            SELECT
                id,
                name,
                email
            FROM customers
            WHERE id = $1
            LIMIT 1
            `,
            [invoice.customer_id]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }

        const customer = customerResult.rows[0];
        const amountInKobo = Math.round( Number(invoice.total) * 100 );

        const reference =`INV-${invoice.id}-${Date.now()}`;

        // Initialize payment with Paystack
        const paystackResponse = await fetch(
            "https://api.paystack.co/transaction/initialize",
            {
                method: "POST",
                headers: {
                    Authorization:
                        `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    email: customer.email,

                    amount: String(
                        amountInKobo
                    ),

                    currency:
                        invoice.currency,

                    reference,

                  callback_url:
    `${process.env.APP_URL}/payment/callback`,

metadata: {invoice_id:String(invoice.id),

    invoice_number:
        invoice.invoice_number,

    customer_id:
        String(customer.id)
}
                })
            }
        );

        const paystackData = await paystackResponse.json();

        if (
            !paystackResponse.ok ||
            !paystackData.status
        ) {
            console.error(
                "Paystack initialization failed:", paystackData );

            return res.status(502).json({
                error: "Unable to initialize payment."  });
        }

        await client.query(
            `
            INSERT INTO payment_attempts (
                customer_id,
                invoice_id,
                provider,
                provider_reference,
                amount,
                currency,
                status,
                authorization_url
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
            )
            `,
            [
                customer.id,
                invoice.id,
                "paystack",
                paystackData.data.reference,
                invoice.total,
                invoice.currency,
                "pending",
                paystackData.data.authorization_url
            ]
        );

        return res.status(201).json({

            message:  "Payment initialized successfully.",

            reference: paystackData.data.reference,

            authorizationUrl: paystackData.data.authorization_url,

            accessCode: paystackData.data.access_code,

            invoice: {
                id:
                    invoice.id,

                invoiceNumber:
                    invoice.invoice_number,

                amount:
                    Number(invoice.total),

                currency:
                    invoice.currency
            }

        });

    } catch (error) {

        console.error(
            "Failed to initialize payment:",error
        );

        return res.status(500).json({
            error: "Unable to initialize payment."
        });

    } finally {

        client.release();

    }
}

module.exports = {
    createPayment
};

async function verifyPayment(req, res) {
    const client = await pool.connect();

    let transactionStarted = false;

    try {
        const { reference } = req.params;

        if (!reference) {
            return res.status(400).json({ error: "Payment reference is required" });
        }

        // Find our payment attempt first
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
            WHERE provider_reference = $1
            LIMIT 1
            `,
            [reference]
        );

        if (attemptResult.rows.length === 0) {
            return res.status(404).json({ error: "Payment attempt not found"});
        }

        const attempt = attemptResult.rows[0];

        const paystackResponse = await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
            {
                method: "GET",

                headers: {
                    Authorization:
                        `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const paystackData =
            await paystackResponse.json();

        if (
            !paystackResponse.ok ||
            !paystackData.status
        ) {
            console.error(
                "Paystack verification failed:",paystackData
            );

            return res.status(502).json({
                error: "Unable to verify payment."
            });
        }

        const transaction =
            paystackData.data;


        const expectedAmount =
            Math.round(Number(attempt.amount) * 100
            );

        const amountMatches =
            Number(transaction.amount) === expectedAmount;

        const currencyMatches =
            String(transaction.currency || "")
                .toUpperCase() ===
            String(attempt.currency || "")
                .toUpperCase();

        const referenceMatches =
            transaction.reference ===
            attempt.provider_reference;

        if (
            transaction.status !== "success" ||
            !amountMatches ||
            !currencyMatches ||
            !referenceMatches
        ) {
            await client.query(
                `
                UPDATE payment_attempts
                SET
                    status = $1,
                    updated_at = NOW()
                WHERE id = $2
                `,
                [
                    transaction.status || "failed",
                    attempt.id
                ]
            );

            return res.status(400).json({
                success: false,

                message:
                    "Payment could not be verified.",

                paymentStatus:
                    transaction.status,

                amountMatches,

                currencyMatches,

                referenceMatches
            });
        }

   
        await client.query("BEGIN");
        transactionStarted = true;

        const existingTransaction =
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
            existingTransaction.rows.length === 0
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
                    $3,
                    $4,
                    $5,
                    $6,
                    $7
                )
                `,
                [
                    attempt.customer_id,
                    attempt.invoice_id,
                    "paystack",
                    reference,
                    attempt.amount,
                    attempt.currency,
                    "successful"
                ]
            );
        }

        await client.query(
            `
            UPDATE payment_attempts
            SET
                status = 'successful',
                updated_at = NOW()
            WHERE id = $1
            `,
            [attempt.id]
        );

        await client.query(
            `
            UPDATE invoices
            SET
                status = 'paid',
                updated_at = NOW()
            WHERE id = $1
              AND status <> 'paid'
            `,
            [attempt.invoice_id]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.status(200).json({
            success: true,

            message:
                "Payment verified successfully.",

            reference,

            amount:
                attempt.amount,

            currency:
                attempt.currency,

            status:
                "successful"
        });

    } catch (error) {

        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        console.error(
            "Payment verification error:",
            error
        );

        return res.status(500).json({
            error:
                "Unable to verify payment."
        });

    } finally {

        client.release();
    }
}


module.exports = { createPayment, verifyPayment };