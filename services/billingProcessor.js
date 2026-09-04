const pool = require("../server/db/database");

const {
    generateInvoiceForSubscription
} = require("./invoiceGenerator");


async function processRecurringBilling() {

    console.log(
        "Checking subscriptions for recurring billing..."
    );

    try {

        const result = await pool.query(
            `
            SELECT
                id,
                customer_id,
                name,
                billing_interval,
                next_billing_date
            FROM subscriptions
            WHERE status = 'active'
              AND next_billing_date <= CURRENT_DATE
            ORDER BY next_billing_date ASC
            `
        );

        if (result.rows.length === 0) {

            console.log(
                "No subscriptions are due for billing."
            );

            return;
        }

        console.log(
            `${result.rows.length} subscription(s) due for billing.`
        );


        for (const subscription of result.rows) {

            try {

                console.log(
                    `Processing subscription ${subscription.id} - ${subscription.name}`
                );

                const invoice =
                    await generateInvoiceForSubscription(
                        subscription.id
                    );

                if (invoice.created) {

                    console.log(
                        `Invoice created: ${invoice.invoice.invoice_number}`
                    );

                } else {

                    console.log(
                        `Invoice already exists: ${invoice.invoice.invoice_number}`
                    );
                }

            } catch (error) {

                console.error(
                    `Failed to process subscription ${subscription.id}:`,
                    error.message
                );

            }
        }

    } catch (error) {

        console.error(
            "Recurring billing processor failed:",
            error
        );

        throw error;
    }
}


module.exports = {
    processRecurringBilling
};