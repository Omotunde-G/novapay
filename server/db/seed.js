require("dotenv").config();

const pool = require("./database");

async function seedDatabase() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");


        const customerResult = await client.query(
            `
            INSERT INTO customers (
                name,
                email,
                company_name,
                status
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id
            `,
            [
                "Mr Alpha",
                "alpha@example.com",
                "Alpha Technologies",
                "active"
            ]
        );

        const customerId = customerResult.rows[0].id;


    

        await client.query(
            `
            INSERT INTO billing_profiles (
                customer_id,
                billing_email,
                address,
                city,
                country
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                customerId,
                "billing@example.com",
                "12 Innovation Avenue",
                "Abuja",
                "Nigeria"
            ]
        );



        const paymentMethodResult = await client.query(
            `
            INSERT INTO payment_methods (
                customer_id,
                provider,
                provider_reference,
                brand,
                last_four,
                expiry_month,
                expiry_year,
                is_default
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
            `,
            [
                customerId,
                "demo",
                "pm_demo_4821",
                "VISA",
                "4821",
                9,
                2028,
                true
            ]
        );

        const paymentMethodId =
            paymentMethodResult.rows[0].id;



        const invoiceResult = await client.query(
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
                $7,
                $8,
                $9
            )
            RETURNING id
            `,
            [
                customerId,
                "INV-2026-0901",
                "NGN",
                85000,
                0,
                85000,
                "open",
                "2026-08-18",
                "2026-09-01"
            ]
        );

        const invoiceId = invoiceResult.rows[0].id;

        await client.query(
            `
            INSERT INTO invoice_items (
                invoice_id,
                description,
                quantity,
                unit_amount,
                amount
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                invoiceId,
                "Business Pro",
                1,
                75000,
                75000
            ]
        );

        await client.query(
            `
            INSERT INTO invoice_items (
                invoice_id,
                description,
                quantity,
                unit_amount,
                amount
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                invoiceId,
                "Additional Seats",
                1,
                10000,
                10000
            ]
        );

        await client.query(
            `
            INSERT INTO transactions (
                customer_id,
                invoice_id,
                payment_method_id,
                provider,
                provider_reference,
                amount,
                currency,
                status
            )
            VALUES (
                $1,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
            )
            `,
            [
                customerId,
                paymentMethodId,
                "demo",
                "txn_demo_001",
                125000,
                "NGN",
                "successful"
            ]
        );


        await client.query(
            `
            INSERT INTO transactions (
                customer_id,
                invoice_id,
                payment_method_id,
                provider,
                provider_reference,
                amount,
                currency,
                status
            )
            VALUES (
                $1,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
            )
            `,
            [
                customerId,
                paymentMethodId,
                "demo",
                "txn_demo_002",
                75000,
                "NGN",
                "successful"
            ]
        );


        await client.query("COMMIT");

        console.log("Database seeded successfully.");
        console.log(`Customer ID: ${customerId}`);
        console.log(`Invoice ID: ${invoiceId}`);

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Database seeding failed:",
            error
        );

    } finally {

        client.release();

        await pool.end();

    }
}

seedDatabase();