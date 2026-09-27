/* =========================================================
   BANCO CHAGAS&HILGERS
   MOTOR DA SIMULAÇÃO — VERSÃO COMPARTILHADA E PROTEGIDA
   Firebase Authentication + Realtime Database
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";


/* =========================================================
   CONFIGURAÇÃO DA SIMULAÇÃO
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
   INICIALIZAÇÃO FIREBASE
========================================================= */

const app =
    initializeApp(firebaseConfig);

const auth =
    getAuth(app);

const database =
    getDatabase(app);

const simulationRef =
    ref(database, "simulation");


/* =========================================================
   ESTADO
========================================================= */

let state = createInitialState();

let firebaseLoaded = false;

let databaseListenerStarted = false;


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
   LOCAL STORAGE — MIGRAÇÃO
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

            ...parsed,

            transactions:
                Array.isArray(
                    parsed.transactions
                )
                    ? parsed.transactions
                    : []

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
   SALVAR NO FIREBASE
========================================================= */

async function saveState() {

    if (!firebaseLoaded) {

        alert(
            "A simulação ainda está carregando. Aguarde alguns segundos."
        );

        return false;

    }

    try {

        await set(
            simulationRef,
            state
        );

        console.log(
            "Simulação salva no Firebase."
        );

        return true;

    } catch (error) {

        console.error(
            "Erro ao salvar no Firebase:",
            error
        );

        alert(
            "Não foi possível salvar a movimentação."
        );

        return false;

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
   TELA DE LOGIN
========================================================= */

function createLoginScreen() {

    if (
        document.getElementById(
            "chLoginScreen"
        )
    ) {

        return;

    }


    const screen =
        document.createElement(
            "div"
        );


    screen.id =
        "chLoginScreen";


    screen.innerHTML = `

        <div class="ch-login-box">

            <div class="ch-login-logo">

                <img
                    src="logo.png"
                    alt="Chagas&Hilgers"
                >

            </div>


            <div class="ch-login-brand">

                <strong>
                    Chagas&Hilgers
                </strong>

                <span>
                    Financiamento do Apto
                </span>

            </div>


            <div class="ch-login-title">
                Acesso privado
            </div>


            <div class="ch-login-subtitle">
                Entre para acessar a simulação compartilhada.
            </div>


            <form id="chLoginForm">

                <label>
                    E-mail
                </label>

                <input
                    id="chLoginEmail"
                    type="email"
                    autocomplete="username"
                    placeholder="seu e-mail"
                    required
                >


                <label>
                    Senha
                </label>

                <input
                    id="chLoginPassword"
                    type="password"
                    autocomplete="current-password"
                    placeholder="sua senha"
                    required
                >


                <div
                    id="chLoginError"
                    class="ch-login-error"
                ></div>


                <button
                    type="submit"
                    id="chLoginButton"
                >
                    Entrar
                </button>

            </form>


            <div class="ch-login-footer">
                Acesso protegido por Firebase
            </div>

        </div>

    `;


    document.body.appendChild(
        screen
    );


    const form =
        document.getElementById(
            "chLoginForm"
        );


    form.addEventListener(
        "submit",
        handleLogin
    );


    addLoginStyles();

}


/* =========================================================
   ESTILO DA TELA DE LOGIN
========================================================= */

function addLoginStyles() {

    if (
        document.getElementById(
            "chLoginStyles"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "chLoginStyles";


    style.textContent = `

        #chLoginScreen {

            position: fixed;

            inset: 0;

            z-index: 999999;

            display: flex;

            align-items: center;

            justify-content: center;

            padding: 24px;

            background:
                #071525;

            font-family:
                "DM Sans",
                sans-serif;

        }


        .ch-login-box {

            width: 100%;

            max-width: 390px;

            padding: 34px 28px;

            border-radius: 24px;

            background: #ffffff;

            box-shadow:
                0 25px 80px
                rgba(0,0,0,.35);

        }


        .ch-login-logo {

            display: flex;

            justify-content: center;

            margin-bottom: 16px;

        }


        .ch-login-logo img {

            width: 64px;

            height: 64px;

            object-fit: contain;

            border-radius: 16px;

        }


        .ch-login-brand {

            display: flex;

            flex-direction: column;

            align-items: center;

            margin-bottom: 30px;

        }


        .ch-login-brand strong {

            font-family:
                "Playfair Display",
                serif;

            font-size: 22px;

            color: #071525;

        }


        .ch-login-brand span {

            margin-top: 3px;

            font-size: 11px;

            color: #7a8491;

        }


        .ch-login-title {

            font-size: 20px;

            font-weight: 700;

            color: #071525;

            margin-bottom: 7px;

        }


        .ch-login-subtitle {

            font-size: 12px;

            line-height: 1.5;

            color: #7a8491;

            margin-bottom: 22px;

        }


        #chLoginForm {

            display: flex;

            flex-direction: column;

        }


        #chLoginForm label {

            font-size: 11px;

            font-weight: 600;

            color: #34404d;

            margin-bottom: 7px;

        }


        #chLoginForm input {

            width: 100%;

            box-sizing: border-box;

            height: 46px;

            padding: 0 14px;

            margin-bottom: 16px;

            border: 1px solid #dce1e7;

            border-radius: 12px;

            outline: none;

            background: #f8f9fb;

            color: #071525;

            font-family:
                "DM Sans",
                sans-serif;

            font-size: 13px;

        }


        #chLoginForm input:focus {

            border-color: #071525;

            background: #ffffff;

        }


        #chLoginButton {

            width: 100%;

            height: 48px;

            margin-top: 4px;

            border: 0;

            border-radius: 12px;

            background: #071525;

            color: #ffffff;

            font-family:
                "DM Sans",
                sans-serif;

            font-size: 13px;

            font-weight: 700;

            cursor: pointer;

        }


        #chLoginButton:disabled {

            opacity: .6;

            cursor: default;

        }


        .ch-login-error {

            display: none;

            margin: -4px 0 14px;

            padding: 10px 12px;

            border-radius: 10px;

            background: #fff1f1;

            color: #a33a3a;

            font-size: 11px;

            line-height: 1.4;

        }


        .ch-login-footer {

            margin-top: 22px;

            text-align: center;

            font-size: 9px;

            color: #a0a8b1;

        }


        @media (max-width: 520px) {

            .ch-login-box {

                padding: 30px 22px;

                border-radius: 21px;

            }

        }

    `;


    document.head.appendChild(
        style
    );

}


/* =========================================================
   LOGIN
========================================================= */

async function handleLogin(event) {

    event.preventDefault();


    const emailInput =
        document.getElementById(
            "chLoginEmail"
        );


    const passwordInput =
        document.getElementById(
            "chLoginPassword"
        );


    const button =
        document.getElementById(
            "chLoginButton"
        );


    const errorBox =
        document.getElementById(
            "chLoginError"
        );


    const email =
        emailInput.value.trim();


    const password =
        passwordInput.value;


    errorBox.style.display =
        "none";


    button.disabled =
        true;


    button.textContent =
        "Entrando...";


    try {

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );


        console.log(
            "Login realizado com sucesso."
        );


    } catch (error) {

        console.error(
            "Erro de login:",
            error
        );


        let message =
            "Não foi possível entrar. Verifique o e-mail e a senha.";


        if (
            error.code ===
            "auth/invalid-credential"
        ) {

            message =
                "E-mail ou senha incorretos.";

        }


        if (
            error.code ===
            "auth/invalid-email"
        ) {

            message =
                "Digite um e-mail válido.";

        }


        if (
            error.code ===
            "auth/too-many-requests"
        ) {

            message =
                "Muitas tentativas. Aguarde um pouco e tente novamente.";

        }


        errorBox.textContent =
            message;


        errorBox.style.display =
            "block";


        button.disabled =
            false;


        button.textContent =
            "Entrar";

    }

}


/* =========================================================
   ESCONDER / MOSTRAR LOGIN
========================================================= */

function hideLoginScreen() {

    const screen =
        document.getElementById(
            "chLoginScreen"
        );


    if (screen) {

        screen.remove();

    }

}


function showLoginScreen() {

    createLoginScreen();

}


/* =========================================================
   INICIALIZAR BANCO DE DADOS
========================================================= */

async function startDatabaseListener() {

    if (databaseListenerStarted) {

        return;

    }


    databaseListenerStarted =
        true;


    onValue(
        simulationRef,
        async (snapshot) => {

            try {

                if (snapshot.exists()) {

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


                    firebaseLoaded =
                        true;


                    updateDashboard();


                    console.log(
                        "Simulação carregada do Firebase."
                    );


                    return;

                }


                /*
                 * Firebase vazio.
                 *
                 * Tenta migrar os dados que estavam
                 * anteriormente no localStorage.
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


                firebaseLoaded =
                    true;


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
                    "Erro ao sincronizar Firebase:",
                    error
                );


                firebaseLoaded =
                    false;

            }

        }
    );

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    try {

        await signOut(
            auth
        );

        firebaseLoaded =
            false;

        databaseListenerStarted =
            false;

        state =
            createInitialState();

        updateDashboard();

        showLoginScreen();

    } catch (error) {

        console.error(
            "Erro ao sair:",
            error
        );

    }

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

window.logout =
    logout;


/* =========================================================
   AUTENTICAÇÃO
========================================================= */

onAuthStateChanged(
    auth,
    async (user) => {

        if (user) {

            console.log(
                "Usuário autenticado:",
                user.uid
            );


            hideLoginScreen();


            await startDatabaseListener();


            return;

        }


        firebaseLoaded =
            false;


        showLoginScreen();

    }
);
