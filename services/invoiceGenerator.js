const pool = require("../server/db/database");

async function generateInvoiceForSubscription(subscriptionId) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const subscriptionResult = await client.query(
            `
            SELECT
                s.id,
                s.customer_id,
                s.name,
                s.billing_interval,
                s.currency,
                s.status,
                s.next_billing_date::text AS next_billing_date
            FROM subscriptions s
            WHERE s.id = $1
              AND s.status = 'active'
            FOR UPDATE
            `,
            [subscriptionId]
        );

        if (subscriptionResult.rows.length === 0) {
            throw new Error("Active subscription not found");
        }

       const subscription = subscriptionResult.rows[0];

const billingDate =
    subscription.next_billing_date;

const outstandingInvoiceResult =
    await client.query(
        `
        SELECT
            id,
            invoice_number,
            due_date,
            total,
            status
        FROM invoices
        WHERE customer_id = $1
          AND status IN ('open', 'overdue')
          AND due_date < $2::date
        ORDER BY due_date ASC
        LIMIT 1
        `,
        [
            subscription.customer_id,
            billingDate
        ]
    );

if (outstandingInvoiceResult.rows.length > 0) {

    await client.query("COMMIT");

    return {
        created: false,
        blocked: true,
        reason: "Previous invoice is still unpaid",
        invoice: outstandingInvoiceResult.rows[0]
    };
}


const [year, month, day] =
    billingDate.split("-");

        const invoiceNumber =
            `INV-${year}-${month}${day}`;

        const existingInvoiceResult =
            await client.query(
                `
                SELECT
                    id,
                    invoice_number,
                    status
                FROM invoices
                WHERE invoice_number = $1
                LIMIT 1
                `,
                [invoiceNumber]
            );

        if (existingInvoiceResult.rows.length > 0) {

            await client.query("COMMIT");

            return {
                created: false,
                invoice: existingInvoiceResult.rows[0]
            };
        }

        const itemsResult = await client.query(
            `
            SELECT
                description,
                quantity,
                unit_amount
            FROM subscription_items
            WHERE subscription_id = $1
            ORDER BY id ASC
            `,
            [subscription.id]
        );

        if (itemsResult.rows.length === 0) {
            throw new Error(
                "Subscription has no billing items"
            );
        }

        let subtotal = 0;

        for (const item of itemsResult.rows) {

            subtotal +=
                Number(item.quantity) *
                Number(item.unit_amount);
        }

        const tax = 0;

        const total =
            subtotal + tax;

        const invoiceResult =
            await client.query(
                `
                INSERT INTO invoices (
                    customer_id,
                    invoice_number,
                    currency,
                    subtotal,
                    tax,
                    total,
                    status,
                    issue_date,
                    due_date
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    'open',
                    CURRENT_DATE,
                    $7
                )
                RETURNING *
                `,
                [
                    subscription.customer_id,
                    invoiceNumber,
                    subscription.currency,
                    subtotal,
                    tax,
                    total,
                    billingDate
                ]
            );

        const invoice =
            invoiceResult.rows[0];

   
        for (const item of itemsResult.rows) {

            const amount =
                Number(item.quantity) *
                Number(item.unit_amount);

            await client.query(
                `
                INSERT INTO invoice_items (
                    invoice_id,
                    description,
                    quantity,
                    unit_amount,
                    amount
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                `,
                [
                    invoice.id,
                    item.description,
                    item.quantity,
                    item.unit_amount,
                    amount
                ]
            );
        }


        let nextBillingDate = null;

        if (
            subscription.billing_interval ===
            "monthly"
        ) {

            const result = await client.query(
                `
                SELECT
                    (
                        $1::date +
                        INTERVAL '1 month'
                    )::date AS next_date
                `,
                [billingDate]
            );

            nextBillingDate =
                result.rows[0].next_date;

        } else if (
            subscription.billing_interval ===
            "yearly"
        ) {

            const result = await client.query(
                `
                SELECT
                    (
                        $1::date +
                        INTERVAL '1 year'
                    )::date AS next_date
                `,
                [billingDate]
            );

            nextBillingDate =
                result.rows[0].next_date;
        }

        if (!nextBillingDate) {
            throw new Error(
                `Unsupported billing interval: ${subscription.billing_interval}`
            );
        }


        await client.query(
            `
            UPDATE subscriptions
            SET
                next_billing_date = $1::date,
                updated_at = NOW()
            WHERE id = $2
            `,
            [
                nextBillingDate,
                subscription.id
            ]
        );

        await client.query("COMMIT");

        return {
            created: true,
            invoice
        };

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();
    }
}

module.exports = { generateInvoiceForSubscription};