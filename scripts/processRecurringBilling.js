require("dotenv").config();

const { processRecurringBilling } = require("../services/billingProcessor");

async function main() {
    try {
        await processRecurringBilling();
        process.exit(0);
    } catch (error) {
        console.error("Recurring billing job failed:", error);
        process.exit(1);
    }
}

main();
