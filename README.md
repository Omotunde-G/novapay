# NovaPay

NovaPay is a cloud-based billing and payment platform for managing customer subscriptions, invoices, transactions, and recurring payments.

## Features

* Customer billing dashboard
* Subscription management
* Automated invoice generation
* Invoice line items
* Paystack payment integration
* Payment verification and webhooks
* Transaction tracking
* Payment method display
* Automated recurring billing
* PostgreSQL database
* Cloud deployment

## Tech Stack

* **Backend:** Node.js + Express
* **Database:** PostgreSQL / Neon
* **Payments:** Paystack
* **Deployment:** Render
* **Automation:** GitHub Actions
* **Frontend:** HTML, CSS & JavaScript


Recurring billing is automated through GitHub Actions, which runs the billing processor daily and generates invoices when active subscriptions reach their billing date.

## Local Setup

```bash
git clone https://github.com/Omotunde-G/novapay.git
cd novapay
npm install
```

Create a `.env` file:

```env
DATABASE_URL=your_neon_database_url
PAYSTACK_SECRET_KEY=your_paystack_secret_key
APP_URL=http://localhost:3000
PORT=3000
```

Start the application:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Recurring Billing

To manually run the recurring billing processor:

```bash
npm run billing:process
```

The production billing process runs automatically through GitHub Actions.

## Live Demo

[NovaPay Live Demo](https://novapay-5koc.onrender.com)

## Repository

[NovaPay on GitHub](https://github.com/Omotunde-G/novapay)

> **Note:** This is currently a demo/MVP using Paystack test mode. No real payments are processed.
