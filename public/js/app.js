async function loadBillingOverview() {

    try {

        const response = await fetch("/api/billing/overview" );

        if (!response.ok) {throw new Error("Failed to load billing information" );
        }

        const data = await response.json();

        updateBillingDashboard(data);

    } catch (error) {

        console.error("Billing dashboard error:", error );

        showNotification( "Unable to load billing information." );
    }
}
function updateBillingDashboard(data) {

    renderNextPayment(data);

    if (data.paymentMethod) {

        const paymentMethod = data.paymentMethod;


        const cardBrand = document.querySelector("#payment-card-brand");

        if (cardBrand) { cardBrand.textContent = paymentMethod.brand;}


        const cardNumber =
            document.querySelector("#payment-card-number");

        if (cardNumber) {
            cardNumber.textContent =
                `•••• •••• •••• ${paymentMethod.last_four}`;
        }


        const cardExpiry =
            document.querySelector("#payment-card-expiry");

        if (cardExpiry) {

            const month =
                String(
                    paymentMethod.expiry_month
                ).padStart(2, "0");

            const year =
                String(
                    paymentMethod.expiry_year
                ).slice(-2);

            cardExpiry.textContent =
                `Expires ${month}/${year}`;
        }

    }




    renderTransactions(
        data.transactions,
        data.paymentMethod
    );




    renderUpcomingInvoice(data);
}

function renderNextPayment(data) {

    const amountElement =
        document.querySelector("#next-payment-amount");

    const dateElement =
        document.querySelector("#next-payment-date");

    if (!amountElement || !dateElement) {
        return;
    }


    const invoice =
        data.invoices &&
        data.invoices.length > 0
            ? data.invoices[0]
            : null;




    if (!invoice) {

        amountElement.textContent =
            "No payment scheduled";

        dateElement.textContent =
            "No upcoming payment";

        return;
    }




    amountElement.textContent =
        formatCurrency(
            invoice.total,
            invoice.currency
        );




    if (invoice.due_date) {

        dateElement.textContent =
            `Due ${formatFullDate(invoice.due_date)}`;

    } else {

        dateElement.textContent =
            "Payment date unavailable";
    }
}
function formatFullDate(dateString) {

    if (!dateString) {
        return "";
    }

    const date =
        new Date(`${dateString}T00:00:00`);

    return new Intl.DateTimeFormat(
        "en-NG",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    ).format(date);
}

function formatCurrency(amount, currency = "NGN") {

    return new Intl.NumberFormat(
        "en-NG",
        {
            style: "currency",
            currency,
            minimumFractionDigits: 2
        }
    ).format(amount);

}


function formatDate(dateString) {

    if (!dateString) {
        return "";
    }

    const date =
        new Date(dateString);

    return new Intl.DateTimeFormat(
        "en-NG",
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    ).format(date);

}
async function handlePaymentReturn() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const reference =
        params.get("payment_reference");


    if (!reference) {
        return;
    }


    try {

        showNotification(
            "Verifying your payment..."
        );


        const response =
            await fetch(
                `/api/payments/verify/${encodeURIComponent(reference)}`
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Payment verification failed."
            );

        }


        if (result.success) {

            showNotification(
                "Payment successful."
            );


        

            await loadBillingOverview();



            window.history.replaceState(
                {},
                document.title,
                window.location.pathname
            );

        }

    } catch (error) {

        console.error(
            "Payment verification error:",
            error
        );


        showNotification(
            "We could not verify your payment yet."
        );

    }

}

document.addEventListener("DOMContentLoaded", () => {

    loadBillingOverview();
    handlePaymentReturn();


    const navItems = document.querySelectorAll(".nav-item");
    const mainContent = document.querySelector(".main-content");

    const invoiceButton = document.querySelector(".primary-button");
    const paymentManageButton = document.querySelector(
        ".right-column .panel:first-child .text-button"
    );

    const supportButton = document.querySelector(".support-card button");


    navItems.forEach((item) => {

        item.addEventListener("click", (event) => {

            event.preventDefault();

            navItems.forEach((nav) => {
                nav.classList.remove("active");
            });

            item.classList.add("active");

            const sectionName =
                item.textContent.trim();

            console.log(`Navigation selected: ${sectionName}`);

            if (sectionName !== "Dashboard") {
                showNotification(
                    `${sectionName} section selected.`
                );
            }

        });

    });




   invoiceButton?.addEventListener("click", () => {

    fetch("/api/billing/overview")
        .then((response) => {

            if (!response.ok) {
                throw new Error(
                    "Failed to load invoice"
                );
            }

            return response.json();
        })
        .then((data) => {

            createInvoiceModal(data);

        })
        .catch((error) => {

            console.error(
                "Invoice modal error:",
                error
            );

            showNotification(
                "Unable to load invoice details."
            );

        });

});


 

    paymentManageButton?.addEventListener("click", () => {

        createPaymentMethodModal();

    });



    supportButton?.addEventListener("click", () => {

        showNotification(
            "Support request feature coming soon."
        );

    });


    const transactions =
        document.querySelectorAll(".transaction");

    transactions.forEach((transaction) => {

        transaction.addEventListener("click", () => {

            const name =
                transaction
                    .querySelector(".transaction-details strong")
                    ?.textContent;

            if (!name) return;

            showNotification(
                `Transaction selected: ${name}`
            );

        });

    });


});




function createInvoiceModal(data) {

    removeExistingModal();

    const invoice =
        data.invoices &&
        data.invoices.length > 0
            ? data.invoices[0]
            : null;

    const items =
        data.invoiceItems || [];




    if (!invoice) {

        showNotification(
            "There is no upcoming invoice."
        );

        return;
    }


    const modal =
        document.createElement("div");

    modal.className = "modal-overlay";
    modal.dataset.invoiceId = invoice.id;


    const invoiceItemsHTML =
        items.map((item) => {

            return `
                <div class="invoice-preview-row">
                    <span>${item.description}</span>
                    <strong>
                        ${formatCurrency(
                            item.amount,
                            invoice.currency
                        )}
                    </strong>
                </div>
            `;

        }).join("");


    modal.innerHTML = `

        <div class="modal">

            <div class="modal-header">

                <div>

                    <h2>Upcoming Invoice</h2>

                    <p>
                        Invoice details for
                        ${formatInvoiceMonth(invoice.due_date)}.
                    </p>

                </div>

                <button
                    class="modal-close"
                    aria-label="Close modal"
                >
                    ×
                </button>

            </div>


            <div class="invoice-preview">

                <div class="invoice-preview-row">

                    <span>Invoice number</span>

                    <strong>
                        ${invoice.invoice_number}
                    </strong>

                </div>


                <div class="invoice-preview-row">

                    <span>Issue date</span>

                    <strong>
                        ${formatFullDate(
                            invoice.issue_date
                        )}
                    </strong>

                </div>


                <div class="invoice-preview-row">

                    <span>Due date</span>

                    <strong>
                        ${formatFullDate(
                            invoice.due_date
                        )}
                    </strong>

                </div>


                ${invoiceItemsHTML}


                <div class="invoice-preview-divider"></div>


                <div class="invoice-preview-row total">

                    <span>Total</span>

                    <strong>
                        ${formatCurrency(
                            invoice.total,
                            invoice.currency
                        )}
                    </strong>

                </div>

            </div>


            <div class="modal-actions">

                <button
                    class="secondary-button modal-close-action"
                >
                    Close
                </button>


                <button
                    class="primary-button modal-pay-button"
                >
                    Pay ${formatCurrency(
                        invoice.total,
                        invoice.currency
                    )}
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(modal);

    attachModalEvents(modal);
}



function createPaymentMethodModal() {

    removeExistingModal();

    const modal = document.createElement("div");

    modal.className = "modal-overlay";

    modal.innerHTML = `
        <div class="modal">

            <div class="modal-header">

                <div>
                    <h2>Payment Method</h2>
                    <p>Manage your default payment method.</p>
                </div>

                <button
                    class="modal-close"
                    aria-label="Close modal"
                >
                    ×
                </button>

            </div>

            <div class="payment-method-preview">

                <div class="card-brand large">
                    VISA
                </div>

                <div>
                    <strong>•••• •••• •••• 4821</strong>

                    <span>
                        Expires September 2028
                    </span>
                </div>

            </div>

           <div class="payment-security-note">
    <span>🔒</span>
    <p>
        Payments are securely processed by Paystack.
        Your card details are not stored on this website.
    </p>
</div>

            <div class="modal-actions">

                <button class="secondary-button modal-close-action">
                    Close
                </button>

                <button class="primary-button">
                    Add Payment Method
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    attachModalEvents(modal);

}



function attachModalEvents(modal) {

    const closeButtons =
        modal.querySelectorAll(
            ".modal-close, .modal-close-action"
        );

    closeButtons.forEach((button) => {

        button.addEventListener("click", () => {

            modal.remove();

        });

    });


    modal.addEventListener("click", (event) => {

        if (event.target === modal) {

            modal.remove();

        }

    });


    const payButton =
        modal.querySelector(".modal-pay-button");

payButton?.addEventListener(
    "click",
    async () => {

        try {

        

            if (modal.dataset.authorizationUrl) {

                window.location.href =
                    modal.dataset.authorizationUrl;

                return;
            }


            payButton.disabled = true;

            payButton.textContent =
                "Preparing payment...";


            const invoiceId =
                modal.dataset.invoiceId;


            if (!invoiceId) {

                throw new Error(
                    "Invoice ID is missing."
                );

            }


            const response =
                await fetch(
                    "/api/payments",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            invoiceId
                        })
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    result.error ||
                    "Unable to initialize payment."
                );

            }


    

            modal.dataset.authorizationUrl =
                result.authorizationUrl;


            modal.dataset.paymentReference =
                result.reference;




            payButton.disabled = false;

            payButton.textContent =
                "Continue to Payment →";


            showNotification(
                "Payment is ready. Continue to Paystack."
            );


        } catch (error) {

            console.error(
                "Payment initialization error:",
                error
            );


            payButton.disabled = false;

            payButton.textContent =
                "Try Again";


            showNotification(
                error.message
            );

        }

    }
);
}




function showNotification(message) {

    const existing =
        document.querySelector(".toast");

    existing?.remove();

    const toast =
        document.createElement("div");

    toast.className = "toast";

    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {

        toast.classList.add("show");

    });

    setTimeout(() => {

        toast.classList.remove("show");

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 2500);

}



function removeExistingModal() {

    document
        .querySelector(".modal-overlay")
        ?.remove();

}
function renderTransactions(transactions, paymentMethod) {

    const container =
        document.querySelector("#transactions-list");

    if (!container) {
        return;
    }


    container.replaceChildren();


    if (!transactions || transactions.length === 0) {

        const emptyMessage =
            document.createElement("div");

        emptyMessage.className =
            "transaction-empty";

        emptyMessage.textContent =
            "No transactions yet.";

        container.appendChild(emptyMessage);

        return;
    }

 
    transactions.forEach((transaction) => {

        const transactionElement =
            document.createElement("div");

        transactionElement.className =
            "transaction";


      

        const icon =
            document.createElement("div");

        icon.className =
            "transaction-icon";

        icon.textContent = "TX";



        const details =
            document.createElement("div");

        details.className =
            "transaction-details";


        const title =
            document.createElement("strong");

        title.textContent =
            getTransactionTitle(
                transaction.provider_reference
            );


        const meta =
            document.createElement("span");

        const transactionDate =
            formatDate(
                transaction.created_at
            );

        const cardInfo =
            paymentMethod
                ? `${paymentMethod.brand} •••• ${paymentMethod.last_four}`
                : "Payment method unavailable";

        meta.textContent =
            `${transactionDate} · ${cardInfo}`;


        details.appendChild(title);
        details.appendChild(meta);


      

        const right =
            document.createElement("div");

        right.className =
            "transaction-right";


        const amount =
            document.createElement("strong");

        amount.textContent =
            formatCurrency(
                transaction.amount,
                transaction.currency
            );


        const status =
            document.createElement("span");

        status.className =
            `status ${getStatusClass(transaction.status)}`;

        status.textContent =
            getStatusLabel(transaction.status);


        right.appendChild(amount);
        right.appendChild(status);


 

        transactionElement.appendChild(icon);
        transactionElement.appendChild(details);
        transactionElement.appendChild(right);

        container.appendChild(
            transactionElement
        );

    });
}
function getTransactionTitle(reference) {

    const titles = {
        "txn_demo_001": "Business Pro",
        "txn_demo_002": "API Usage"
    };

    return titles[reference] || "Payment";
}
function getStatusClass(status) {

    const statusMap = {
        successful: "paid",
        pending: "pending",
        processing: "pending",
        failed: "failed",
        cancelled: "failed",
        refunded: "refunded"
    };

    return statusMap[status] || "pending";
}
function getStatusLabel(status) {

    const statusMap = {
        successful: "Paid",
        pending: "Pending",
        processing: "Processing",
        failed: "Failed",
        cancelled: "Cancelled",
        refunded: "Refunded"
    };

    return statusMap[status] || "Unknown";
}
function renderUpcomingInvoice(data) {

    const invoice =
        data.invoices &&
        data.invoices.length > 0
            ? data.invoices[0]
            : null;

    const items =
        data.invoiceItems || [];


    if (!invoice) {

        const period =
            document.querySelector(
                "#invoice-period"
            );

        const total =
            document.querySelector(
                "#invoice-total"
            );

        const bottomTotal =
            document.querySelector(
                "#invoice-total-bottom"
            );

        const itemsContainer =
            document.querySelector(
                "#invoice-items"
            );


        if (period) {
            period.textContent =
                "No upcoming invoice";
        }

        if (total) {
            total.textContent =
                formatCurrency(0, "NGN");
        }

        if (bottomTotal) {
            bottomTotal.textContent =
                formatCurrency(0, "NGN");
        }

        if (itemsContainer) {
            itemsContainer.replaceChildren();
        }

        return;
    }


    const period =
        document.querySelector(
            "#invoice-period"
        );

    if (period) {

        period.textContent =
            formatInvoiceMonth(
                invoice.due_date
            );
    }



    const invoiceTotal =
        document.querySelector(
            "#invoice-total"
        );

    const bottomTotal =
        document.querySelector(
            "#invoice-total-bottom"
        );

    const formattedTotal =
        formatCurrency(
            invoice.total,
            invoice.currency
        );


    if (invoiceTotal) {
        invoiceTotal.textContent =
            formattedTotal;
    }

    if (bottomTotal) {
        bottomTotal.textContent =
            formattedTotal;
    }



    const itemsContainer =
        document.querySelector(
            "#invoice-items"
        );

    if (!itemsContainer) {
        return;
    }

    itemsContainer.replaceChildren();


    items.forEach((item) => {

        const row =
            document.createElement("div");

        row.className =
            "invoice-row";


        const description =
            document.createElement("span");

        description.textContent =
            item.description;


        const amount =
            document.createElement("strong");

        amount.textContent =
            formatCurrency(
                item.amount,
                invoice.currency
            );


        row.appendChild(description);
        row.appendChild(amount);

        itemsContainer.appendChild(row);

    });
}
function formatInvoiceMonth(dateString) {

    if (!dateString) {
        return "";
    }

    const date =
        new Date(`${dateString}T00:00:00`);

    return new Intl.DateTimeFormat(
        "en-NG",
        {
            month: "long",
            year: "numeric"
        }
    ).format(date);
}
