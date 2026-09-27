/* =========================================================
   BANCO CHAGAS&HILGERS
   MOTOR DA SIMULAÇÃO — VERSÃO COMPARTILHADA
   Firebase Realtime Database
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


/* =========================================================
   CONFIGURAÇÃO DO FINANCIAMENTO
========================================================= */

const INITIAL_TARGET = 300000;
const MONTHLY_PAYMENT = 1200;
const BASE_TERM = 360;
const FIRST_PAYMENT_DATE = "2027-01-05";

const STORAGE_KEY = "chagas_hilgers_simulation_v2";


/* =========================================================
   CONFIGURAÇÃO FIREBASE
========================================================= */

const firebaseConfig = {

    apiKey: "AIzaSyA4jUz_wgtt1IO04poSZjJcfBsstM0eh3U",

    authDomain: "chagashilgers.firebaseapp.com",

    projectId: "chagashilgers",

    storageBucket: "chagashilgers.firebasestorage.app",

    messagingSenderId: "962851462458",

    appId: "1:962851462458:web:5cdfda63c394c4079f0403",

    measurementId: "G-JYMPNY0Q45",

    databaseURL:
        "https://chagashilgers-default-rtdb.firebaseio.com"

};


/* =========================================================
   INICIALIZAR FIREBASE
========================================================= */

const app =
    initializeApp(firebaseConfig);


const database =
    getDatabase(app);


const simulationRef =
    ref(database, "simulation");


let firebaseLoaded = false;


/* =========================================================
   ESTADO INICIAL
========================================================= */

function createInitialState() {

    return {

        capital: 0,

        paidInstallments: 0,

        nextInstallmentNumber: 1,

        nextPaymentDate:
            FIRST_PAYMENT_DATE,

        anticipatedMonths: 0,

        transactions: []

    };

}


/* =========================================================
   ESTADO LOCAL — MIGRAÇÃO INICIAL
========================================================= */

function loadLocalState() {

    const saved =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!saved) {

        return null;

    }


    try {

        const parsed =
            JSON.parse(saved);


        return {

            ...createInitialState(),

            ...parsed

        };

    } catch (error) {

        console.error(
            "Erro ao carregar dados locais:",
            error
        );

        return null;

    }

}


/* =========================================================
   ESTADO ATUAL
========================================================= */

let state =
    createInitialState();


/* =========================================================
   SALVAR NO FIREBASE
========================================================= */

async function saveState() {

    if (!firebaseLoaded) {

        console.warn(
            "Firebase ainda não foi carregado."
        );

        return;

    }


    try {

        await set(
            simulationRef,
            state
        );


        console.log(
            "Simulação salva no Firebase."
        );

    } catch (error) {

        console.error(
            "Erro ao salvar no Firebase:",
            error
        );

        alert(
            "Não foi possível salvar a movimentação. Verifique a conexão."
        );

    }

}


/* =========================================================
   FORMATAÇÃO
========================================================= */

function money(value) {

    return new Intl.NumberFormat(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    ).format(value);

}


function number(value) {

    return new Intl.NumberFormat(
        "pt-BR",
        {
            maximumFractionDigits: 1
        }
    ).format(value);

}


function formatDate(dateString) {

    const parts =
        dateString.split("-");


    return `${parts[2]}/${parts[1]}/${parts[0]}`;

}


/* =========================================================
   DATAS
========================================================= */

function getToday() {

    const date =
        new Date();


    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(2, "0"),

        String(
            date.getDate()
        ).padStart(2, "0")

    ].join("-");

}


function addMonths(
    dateString,
    months
) {

    const [
        year,
        month,
        day
    ] =
        dateString
            .split("-")
            .map(Number);


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    date.setMonth(
        date.getMonth() + months
    );


    return [

        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(2, "0"),

        String(
            date.getDate()
        ).padStart(2, "0")

    ].join("-");

}


/* =========================================================
   CÁLCULOS
========================================================= */

function getTotalCapital() {

    return Number(
        state.capital || 0
    );

}


function calculateExtraMonths() {

    return state.transactions

        .filter(
            transaction =>
                transaction.type ===
                "Aporte extraordinário"
        )

        .reduce(

            (
                total,
                transaction
            ) =>

                total +
                (
                    Number(
                        transaction.value
                    ) /
                    MONTHLY_PAYMENT
                ),

            0

        );

}


function calculateRemainingTerm() {

    const savedMonths =

        Number(
            state.paidInstallments || 0
        )

        +

        calculateExtraMonths()

        +

        Number(
            state.anticipatedMonths || 0
        );


    return Math.max(
        0,
        BASE_TERM - savedMonths
    );

}


/* =========================================================
   PRESTAÇÃO MENSAL
========================================================= */

async function registerMonthlyPayment() {

    if (!firebaseLoaded) {

        alert(
            "A simulação ainda está carregando. Aguarde alguns segundos."
        );

        return;

    }


    const paymentDate =
        state.nextPaymentDate;


    const installmentNumber =
        state.nextInstallmentNumber;


    state.capital +=
        MONTHLY_PAYMENT;


    state.paidInstallments++;


    state.nextInstallmentNumber++;


    state.transactions.unshift({

        type:
            "Prestação mensal",

        value:
            MONTHLY_PAYMENT,

        date:
            paymentDate,

        description:
            `Parcela ${installmentNumber}`

    });


    state.nextPaymentDate =
        addMonths(
            paymentDate,
            1
        );


    updateDashboard();


    await saveState();

}


/* =========================================================
   APORTE EXTRAORDINÁRIO
========================================================= */

async function registerExtraContribution() {

    if (!firebaseLoaded) {

        alert(
            "A simulação ainda está carregando. Aguarde alguns segundos."
        );

        return;

    }


    const input =
        document.getElementById(
            "extraAmount"
        );


    const amount =
        Number(
            input.value
        );


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Digite um valor válido para o aporte."
        );

        return;

    }


    state.capital +=
        amount;


    state.transactions.unshift({

        type:
            "Aporte extraordinário",

        value:
            amount,

        date:
            getToday(),

        description:
            "Aporte adicional"

    });


    input.value = "";


    updateDashboard();


    await saveState();

}


/* =========================================================
   ANTECIPAÇÃO DE PARCELAS
========================================================= */

async function anticipateInstallments() {

    if (!firebaseLoaded) {

        alert(
            "A simulação ainda está carregando. Aguarde alguns segundos."
        );

        return;

    }


    const input =
        document.getElementById(
            "anticipationAmount"
        );


    const quantity =
        Number(
            input.value
        );


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


    state.capital +=
        total;


    state.anticipatedMonths +=
        quantity;


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


    updateDashboard();


    await saveState();

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

        modal.classList.add(
            "active"
        );

        modal.classList.remove(
            "hidden"
        );

    }

}


function closeResetModal() {

    const modal =
        document.getElementById(
            "resetModal"
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

        modal.classList.add(
            "hidden"
        );

    }

}


async function confirmReset() {

    if (!firebaseLoaded) {

        return;

    }


    state =
        createInitialState();


    closeResetModal();


    updateDashboard();


    await saveState();

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
            .map(
                transaction => `

                <div class="transaction">

                    <div class="transaction-icon">

                        ${
                            transaction.type ===
                            "Prestação mensal"

                                ? "✓"

                                :

                            transaction.type ===
                            "Aporte extraordinário"

                                ? "+"

                                : "↗"
                        }

                    </div>


                    <div class="transaction-info">

                        <div class="transaction-type">

                            ${transaction.type}

                        </div>


                        <div class="transaction-date">

                            ${formatDate(
                                transaction.date
                            )}

                            ${
                                transaction.description
                                    ? ` · ${transaction.description}`
                                    : ""
                            }

                        </div>

                    </div>


                    <div class="transaction-amount">

                        + ${money(
                            transaction.value
                        )}

                    </div>

                </div>

            `
            )
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
            (
                total /
                INITIAL_TARGET
            ) * 100
        );


    /* VALOR PRINCIPAL */

    const financedAmount =
        document.getElementById(
            "financedAmount"
        );


    if (financedAmount) {

        financedAmount.textContent =
            money(
                INITIAL_TARGET
            );

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
            money(
                INITIAL_TARGET
            );

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
   DISPONIBILIZAR FUNÇÕES PARA O HTML
========================================================= */

window.registerMonthlyPayment =
    registerMonthlyPayment;

window.registerExtraContribution =
    registerExtraContribution;

window.anticipateInstallments =
    anticipateInstallments;

window.openResetModal =
    openResetModal;

window.closeResetModal =
    closeResetModal;

window.confirmReset =
    confirmReset;


/* =========================================================
   CONEXÃO COM FIREBASE
========================================================= */

onValue(
    simulationRef,
    async (snapshot) => {

        try {

            if (snapshot.exists()) {

                /*
                 * Já existe uma simulação no Firebase.
                 * Ela passa a ser a fonte oficial dos dados.
                 */

                const firebaseState =
                    snapshot.val();


                state = {

                    ...createInitialState(),

                    ...firebaseState,

                    transactions:
                        Array.isArray(
                            firebaseState.transactions
                        )
                            ? firebaseState.transactions
                            : []

                };


                firebaseLoaded = true;


                updateDashboard();


                console.log(
                    "Simulação carregada do Firebase."
                );


                return;

            }


            /*
             * O Firebase ainda está vazio.
             *
             * Vamos verificar se este navegador
             * possui a simulação antiga no localStorage.
             *
             * Isso permite migrar os dados existentes
             * para o Firebase na primeira utilização.
             */

            const localState =
                loadLocalState();


            if (localState) {

                state =
                    localState;

            } else {

                state =
                    createInitialState();

            }


            firebaseLoaded = true;


            updateDashboard();


            await set(
                simulationRef,
                state
            );


            console.log(
                "Simulação inicial criada no Firebase."
            );


        } catch (error) {

            console.error(
                "Erro ao sincronizar com Firebase:",
                error
            );


            firebaseLoaded = false;


            alert(
                "Não foi possível conectar à simulação compartilhada."
            );

        }

    }
);
