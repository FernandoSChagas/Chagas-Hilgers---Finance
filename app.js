/* =========================================================
   BANCO CHAGAS&HILGERS
   MOTOR DA SIMULAÇÃO — VERSÃO OFICIAL
========================================================= */

const INITIAL_TARGET = 300000;
const MONTHLY_PAYMENT = 1200;
const BASE_TERM = 360;
const FIRST_PAYMENT_DATE = "2027-01-05";
const STORAGE_KEY = "chagas_hilgers_simulation_v2";


/* =========================================================
   ESTADO INICIAL
========================================================= */

function createInitialState() {
    return {
        capital: 0,
        paidInstallments: 0,
        nextInstallmentNumber: 1,
        nextPaymentDate: FIRST_PAYMENT_DATE,
        anticipatedMonths: 0,
        transactions: []
    };
}


/* =========================================================
   CARREGAR / SALVAR
========================================================= */

function loadState() {

    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        return createInitialState();
    }

    try {

        const parsed = JSON.parse(saved);

        return {
            ...createInitialState(),
            ...parsed
        };

    } catch (error) {

        console.error("Erro ao carregar simulação:", error);

        return createInitialState();
    }
}


let state = loadState();


function saveState() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );
}


/* =========================================================
   FORMATAÇÃO
========================================================= */

function money(value) {

    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(value);

}


function number(value) {

    return new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 1
    }).format(value);

}


function formatDate(dateString) {

    const parts = dateString.split("-");

    return `${parts[2]}/${parts[1]}/${parts[0]}`;

}


/* =========================================================
   DATAS
========================================================= */

function getToday() {

    const date = new Date();

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");

}


function addMonths(dateString, months) {

    const [year, month, day] =
        dateString.split("-").map(Number);

    const date = new Date(
        year,
        month - 1,
        day
    );

    date.setMonth(
        date.getMonth() + months
    );

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");

}


/* =========================================================
   CÁLCULOS
========================================================= */

function getTotalCapital() {

    return state.capital;

}


function calculateExtraMonths() {

    return state.transactions
        .filter(
            transaction =>
                transaction.type === "Aporte extraordinário"
        )
        .reduce(
            (total, transaction) =>
                total + (
                    transaction.value /
                    MONTHLY_PAYMENT
                ),
            0
        );

}


function calculateRemainingTerm() {

    const savedMonths =
        state.paidInstallments +
        calculateExtraMonths() +
        state.anticipatedMonths;

    return Math.max(
        0,
        BASE_TERM - savedMonths
    );

}


/* =========================================================
   PRESTAÇÃO MENSAL
========================================================= */

function registerMonthlyPayment() {

    const paymentDate =
        state.nextPaymentDate;

    const installmentNumber =
        state.nextInstallmentNumber;


    state.capital += MONTHLY_PAYMENT;

    state.paidInstallments++;

    state.nextInstallmentNumber++;


    state.transactions.unshift({

        type: "Prestação mensal",

        value: MONTHLY_PAYMENT,

        date: paymentDate,

        description:
            `Parcela ${installmentNumber}`

    });


    state.nextPaymentDate =
        addMonths(
            paymentDate,
            1
        );


    saveState();

    updateDashboard();

}


/* =========================================================
   APORTE EXTRAORDINÁRIO
========================================================= */

function registerExtraContribution() {

    const input =
        document.getElementById(
            "extraAmount"
        );

    const amount =
        Number(input.value);


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Digite um valor válido para o aporte."
        );

        return;
    }


    state.capital += amount;


    state.transactions.unshift({

        type: "Aporte extraordinário",

        value: amount,

        date: getToday(),

        description:
            "Aporte adicional"

    });


    input.value = "";


    saveState();

    updateDashboard();

}


/* =========================================================
   ANTECIPAÇÃO DE PARCELAS
========================================================= */

function anticipateInstallments() {

    const input =
        document.getElementById(
            "anticipationAmount"
        );

    const quantity =
        Number(input.value);


    if (
        !Number.isInteger(quantity) ||
        quantity <= 0
    ) {

        alert(
            "Digite uma quantidade inteira de parcelas."
        );

        return;
    }


    const total =
        quantity *
        MONTHLY_PAYMENT;


    const firstInstallment =
        state.nextInstallmentNumber;


    const firstDate =
        state.nextPaymentDate;


    const lastInstallment =
        firstInstallment +
        quantity -
        1;


    state.capital += total;

    state.anticipatedMonths += quantity;


    state.nextPaymentDate =
        addMonths(
            firstDate,
            quantity
        );


    state.nextInstallmentNumber +=
        quantity;


    state.transactions.unshift({

        type:
            `Antecipação de ${quantity} parcelas`,

        value:
            total,

        date:
            getToday(),

        description:
            `Parcelas ${firstInstallment} a ${lastInstallment} antecipadas`

    });


    input.value = "";


    saveState();

    updateDashboard();

}


/* =========================================================
   MODAL — NOVA SIMULAÇÃO
========================================================= */

function openResetModal() {

    const modal =
        document.getElementById(
            "resetModal"
        );

    if (modal) {

        modal.classList.add("active");

        modal.classList.remove("hidden");

    }

}


function closeResetModal() {

    const modal =
        document.getElementById(
            "resetModal"
        );

    if (modal) {

        modal.classList.remove("active");

        modal.classList.add("hidden");

    }

}


function confirmReset() {

    state =
        createInitialState();


    localStorage.removeItem(
        STORAGE_KEY
    );


    closeResetModal();

    updateDashboard();

}


/* =========================================================
   HISTÓRICO
========================================================= */

function renderTransactions() {

    const list =
        document.getElementById(
            "transactionList"
        );


    if (!list) return;


    if (
        !state.transactions.length
    ) {

        list.innerHTML = `

            <div class="empty-history">

                <div class="empty-icon">
                    —
                </div>

                <p>
                    Nenhuma movimentação registrada.
                </p>

                <span>
                    As movimentações aparecerão aqui.
                </span>

            </div>

        `;

        return;
    }


    list.innerHTML =
        state.transactions
            .map(transaction => `

                <div class="transaction">

                    <div class="transaction-icon">
                        ${transaction.type === "Prestação mensal"
                            ? "✓"
                            : transaction.type === "Aporte extraordinário"
                                ? "+"
                                : "↗"}
                    </div>

                    <div class="transaction-info">

                        <div class="transaction-type">
                            ${transaction.type}
                        </div>

                        <div class="transaction-date">
                            ${formatDate(transaction.date)}
                            ${transaction.description
                                ? ` · ${transaction.description}`
                                : ""}
                        </div>

                    </div>

                    <div class="transaction-amount">
                        + ${money(transaction.value)}
                    </div>

                </div>

            `)
            .join("");

}


/* =========================================================
   ATUALIZAR PAINEL
========================================================= */

function updateDashboard() {

    const total =
        getTotalCapital();


    const remaining =
        Math.max(
            0,
            INITIAL_TARGET - total
        );


    const progress =
        Math.min(
            100,
            (total / INITIAL_TARGET) * 100
        );


    /* VALOR PRINCIPAL */

    const financedAmount =
        document.getElementById(
            "financedAmount"
        );

    if (financedAmount) {

        financedAmount.textContent =
            money(INITIAL_TARGET);

    }


    /* JÁ DESTINADO */

    const paidAmount =
        document.getElementById(
            "paidAmount"
        );

    if (paidAmount) {

        paidAmount.textContent =
            money(total);

    }


    /* SALDO */

    const remainingAmount =
        document.getElementById(
            "remainingAmount"
        );

    if (remainingAmount) {

        remainingAmount.textContent =
            money(remaining);

    }


    /* PROGRESSO */

    const progressPercent =
        document.getElementById(
            "progressPercent"
        );

    if (progressPercent) {

        progressPercent.textContent =
            `${progress.toFixed(1)}%`;

    }


    const progressFill =
        document.getElementById(
            "progressFill"
        );

    if (progressFill) {

        progressFill.style.width =
            `${progress}%`;

    }


    /* PRAZO RESTANTE */

    const remainingTerm =
        document.getElementById(
            "remainingTerm"
        );

    if (remainingTerm) {

        remainingTerm.textContent =
            number(
                calculateRemainingTerm()
            );

    }


    /* MESES ANTECIPADOS */

    const anticipatedMonths =
        document.getElementById(
            "anticipatedMonths"
        );

    if (anticipatedMonths) {

        anticipatedMonths.textContent =
            number(
                state.anticipatedMonths
            );

    }


    /* PRESTAÇÕES PAGAS */

    const paidInstallments =
        document.getElementById(
            "paidInstallments"
        );

    if (paidInstallments) {

        paidInstallments.textContent =
            state.paidInstallments;

    }


    /* PRÓXIMA PRESTAÇÃO */

    const nextInstallment =
        document.getElementById(
            "nextInstallment"
        );

    if (nextInstallment) {

        nextInstallment.textContent =
            formatDate(
                state.nextPaymentDate
            );

    }


    /* RESUMO */

    const summaryFinanced =
        document.getElementById(
            "summaryFinanced"
        );

    if (summaryFinanced) {

        summaryFinanced.textContent =
            money(INITIAL_TARGET);

    }


    const summaryPaid =
        document.getElementById(
            "summaryPaid"
        );

    if (summaryPaid) {

        summaryPaid.textContent =
            money(total);

    }


    const summaryRemaining =
        document.getElementById(
            "summaryRemaining"
        );

    if (summaryRemaining) {

        summaryRemaining.textContent =
            money(remaining);

    }


    /* HISTÓRICO */

    renderTransactions();

}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateDashboard();

    }
);
