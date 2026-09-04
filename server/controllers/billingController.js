const pool = require("../db/database");
const { generateInvoiceForSubscription} = require("../../services/invoiceGenerator");


async function getBillingOverview(req, res) {
    try {

        const customerResult = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                company_name,
                status
            FROM customers
            ORDER BY id
            LIMIT 1
            `
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({
                error: "Customer not found"
            });
        }

        const customer = customerResult.rows[0];

        const invoiceResult = await pool.query(
            `
            SELECT
    id,
    invoice_number,
    currency,
    total,
    status,
    TO_CHAR(issue_date, 'YYYY-MM-DD') AS issue_date,
    TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
FROM invoices
            WHERE customer_id = $1
              AND status IN ('open', 'overdue')
            ORDER BY due_date ASC
            `,
            [customer.id]
        );
        let invoiceItemsResult = {
    rows: []
};

if (invoiceResult.rows.length > 0) {

    const upcomingInvoiceId =
        invoiceResult.rows[0].id;

    invoiceItemsResult = await pool.query(
        `
        SELECT
            ii.invoice_id,
            ii.description,
            ii.quantity,
            ii.unit_amount,
            ii.amount
        FROM invoice_items ii
        WHERE ii.invoice_id = $1
        ORDER BY ii.id ASC
        `,
        [upcomingInvoiceId]
    );
}
   
        const amountDue = invoiceResult.rows.reduce(
            (total, invoice) => {
                return total + Number(invoice.total);
            },
            0
        );


        const transactionResult = await pool.query(
            `
            SELECT
                id,
                provider_reference,
                amount,
                currency,
                status,
                created_at
            FROM transactions
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT 5
            `,
            [customer.id]
        );

        const paymentMethodResult = await pool.query(
            `
            SELECT
                brand,
                last_four,
                expiry_month,
                expiry_year
            FROM payment_methods
            WHERE customer_id = $1
              AND is_default = TRUE
            LIMIT 1
            `,
            [customer.id]
        );

        const paymentMethod =
            paymentMethodResult.rows[0] || null;

        res.json({
            customer: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                companyName: customer.company_name,
                status: customer.status
            },


            amountDue,

            invoices: invoiceResult.rows,
            invoiceItems: invoiceItemsResult.rows,

            transactions: transactionResult.rows,

            paymentMethod
        });

    } catch (error) {

        console.error(
            "Failed to load billing overview:",
            error
        );

        res.status(500).json({
            error: "Unable to load billing information"
        });
    }
}
async function testGenerateInvoice(req, res) {

    try {

        const subscriptionResult = await pool.query(
            `
            SELECT id
            FROM subscriptions
            WHERE customer_id = 1
              AND status = 'active'
            LIMIT 1
            `
        );

        if (subscriptionResult.rows.length === 0) {
            return res.status(404).json({
                error: "Active subscription not found"
            });
        }

        const subscriptionId =
            subscriptionResult.rows[0].id;

        const result =
            await generateInvoiceForSubscription(
                subscriptionId
            );

        return res.status(
            result.created ? 201 : 200
        ).json({
         message: result.blocked
    ? "Recurring invoice generation blocked"
    : result.created
        ? "Invoice generated successfully"
        : "Invoice already exists",
            ...result
        });

    } catch (error) {

        console.error(
            "Failed to generate invoice:",
            error
        );

        return res.status(500).json({
            error: "Unable to generate invoice",
            details: error.message
        });
    }
}
async function testRecurringBilling(req, res) {
    try {
        const subscriptionResult = await pool.query(
            `
            SELECT id
            FROM subscriptions
            WHERE customer_id = 1
              AND status = 'active'
            LIMIT 1
            `
        );

        if (subscriptionResult.rows.length === 0) {
            return res.status(404).json({
                error: "Active subscription not found"
            });
        }

        const subscriptionId =
            subscriptionResult.rows[0].id;

        const result =
            await generateInvoiceForSubscription(
                subscriptionId
            );

        return res.status(
            result.created ? 201 : 200
        ).json({
            message: result.created
                ? "Recurring invoice generated successfully"
                : "Invoice already exists for this billing cycle",
            ...result
        });

    } catch (error) {
        console.error(
            "Recurring billing test failed:",
            error
        );

        return res.status(500).json({
            error: "Unable to process recurring billing",
            details: error.message
        });
    }
}

module.exports = {
    getBillingOverview,
    testGenerateInvoice,
    testRecurringBilling
};