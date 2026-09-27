/* =========================================================
   BANCO CHAGAS&HILGERS
   MOTOR DA SIMULAÇÃO
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

        earnings: 0,

        // Quantas prestações mensais já foram registradas
        paidInstallments: 0,

        // Número da próxima prestação
        nextInstallmentNumber: 1,

        // Data da próxima prestação
        nextPaymentDate: FIRST_PAYMENT_DATE,

        // Quantidade total de meses antecipados
        anticipatedMonths: 0,

        // Histórico
        transactions: []

    };

}


/* =========================================================
   CARREGAR ESTADO
========================================================= */

function loadState() {

    const saved =
        localStorage.getItem(STORAGE_KEY);


    if (!saved) {

        return createInitialState();

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
            "Erro ao carregar simulação:",
            error
        );

        return createInitialState();

    }

}


/* =========================================================
   ESTADO ATUAL
========================================================= */

let state = loadState();


/* =========================================================
   SALVAR
========================================================= */

function saveState() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );

}


/* =========================================================
   DINHEIRO
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


/* =========================================================
   NÚMERO
========================================================= */

function number(value) {

    return new Intl.NumberFormat(
        "pt-BR",
        {
            maximumFractionDigits: 1
        }
    ).format(value);

}


/* =========================================================
   DATA
========================================================= */

function formatDate(dateString) {

    const parts =
        dateString.split("-");


    return `${parts[2]}/${parts[1]}/${parts[0]}`;

}


/* =========================================================
   DATA ATUAL
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


/* =========================================================
   SOMAR MESES
========================================================= */

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
   PATRIMÔNIO TOTAL
========================================================= */

function getTotalBalance() {

    return (
        state.capital +
        state.earnings
    );

}


/* =========================================================
   MESES ECONOMIZADOS
========================================================= */

function calculateSavedMonths() {

    /*
        Cada prestação mensal = 1 mês
    */

    const monthlyMonths =
        state.paidInstallments;


    /*
        Cada R$ 1.200 de aporte extraordinário
        representa 1 mês de redução do prazo.
    */

    const extraMonths =
        state.transactions
            .filter(
                transaction =>
                    transaction.type ===
                    "Aporte extraordinário"
            )
            .reduce(

                (total, transaction) => {

                    return (
                        total +
                        (
                            transaction.value /
                            MONTHLY_PAYMENT
                        )
                    );

                },

                0

            );


    /*
        Antecipações são contabilizadas
        separadamente.
    */

    const anticipatedMonths =
        state.anticipatedMonths;


    return (
        monthlyMonths +
        extraMonths +
        anticipatedMonths
    );

}


/* =========================================================
   PRAZO RESTANTE
========================================================= */

function calculateRemainingTerm() {

    const saved =
        calculateSavedMonths();


    return Math.max(
        0,
        BASE_TERM - saved
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


    /*
        Adiciona R$ 1.200 ao capital.
    */

    state.capital +=
        MONTHLY_PAYMENT;


    /*
        Uma prestação foi efetivamente paga.
    */

    state.paidInstallments++;


    /*
        A próxima prestação passa
        para o número seguinte.
    */

    state.nextInstallmentNumber++;


    /*
        Registra no histórico.
    */

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


    /*
        IMPORTANTE:

        A próxima prestação é
        sempre o dia 5 do mês seguinte.

        Nunca haverá:

        05/01
        05/01
        05/01

        após três pagamentos.

    */

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


    /*
        O aporte entra no patrimônio.

        Ele NÃO muda a data da próxima
        prestação.

        Também NÃO muda o número da
        próxima prestação.

        A redução do prazo é calculada
        separadamente.
    */

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


    /*
        Validação
    */

    if (
        !Number.isInteger(quantity) ||
        quantity <= 0
    ) {

        alert(
            "Digite uma quantidade inteira de parcelas."
        );

        return;

    }


    /*
        Valor total da antecipação.

        Exemplo:

        31 × R$ 1.200
        = R$ 37.200
    */

    const total =
        quantity *
        MONTHLY_PAYMENT;


    /*
        Guardamos a situação
        ANTES da antecipação.
    */

    const firstInstallment =
        state.nextInstallmentNumber;


    const firstDate =
        state.nextPaymentDate;


    /*
        Última parcela antecipada.
    */

    const lastInstallment =
        firstInstallment +
        quantity -
        1;


    /*
        O dinheiro entra no patrimônio.
    */

    state.capital +=
        total;


    /*
        AQUI ESTÁ A CORREÇÃO:

        Se antecipamos 31 parcelas,
        o contador passa a registrar
        31 meses antecipados.

        Exemplo:

        0 → 31
        31 → 62
        etc.
    */

    state.anticipatedMonths +=
        quantity;


    /*
        A próxima prestação também
        avança exatamente a mesma
        quantidade de meses.

        Exemplo:

        próxima: 05/01/2027

        antecipar 3

        nova próxima:
        05/04/2027
    */

    state.nextPaymentDate =
        addMonths(
            firstDate,
            quantity
        );


    /*
        E o número da próxima prestação
        também avança.

        Parcela 1
        + 3 antecipadas

        próxima = Parcela 4
    */

    state.nextInstallmentNumber +=
        quantity;


    /*
        Histórico.
    */

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
   RESET
========================================================= */

function resetSimulation() {

    const modal =
        document.getElementById(
            "resetModal"
        );


    if (modal) {

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

        modal.classList.add(
            "hidden"
        );

    }

}


function confirmReset() {

    /*
        Volta absolutamente tudo
        ao estado inicial.
    */

    state =
        createInitialState();


    /*
        Remove os dados salvos.
    */

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


    if (!state.transactions.length) {

        list.innerHTML = `
            <div class="empty-history">
                Nenhuma movimentação registrada.
            </div>
        `;

        return;

    }


    list.innerHTML =
        state.transactions
            .map(
                transaction => `

                    <div class="transaction">

                        <div>

                            <div class="transaction-title">

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


                        <div class="transaction-value">

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
   DASHBOARD
========================================================= */

function updateDashboard() {

    const total =
        getTotalBalance();


    /*
        Quanto falta para R$ 300 mil.
    */

    const remaining =
        Math.max(
            0,
            INITIAL_TARGET - total
        );


    /*
        Quanto já passou da meta.
    */

    const surplus =
        Math.max(
            0,
            total - INITIAL_TARGET
        );


    /*
        Percentual da meta.
    */

    const progress =
        Math.min(
            100,
            (
                total /
                INITIAL_TARGET
            ) * 100
        );


    /*
        Patrimônio.
    */

    document.getElementById(
        "totalBalance"
    ).textContent =
        money(total);


    /*
        Capital.
    */

    document.getElementById(
        "capitalBalance"
    ).textContent =
        money(state.capital);


    /*
        Rendimentos.
    */

    document.getElementById(
        "earningsBalance"
    ).textContent =
        money(state.earnings);


    /*
        Excedente.
    */

    document.getElementById(
        "surplusBalance"
    ).textContent =
        money(surplus);


    /*
        Restante.
    */

    document.getElementById(
        "remainingTarget"
    ).textContent =
        money(remaining);


    /*
        Meses antecipados.

        ESTE número agora é atualizado
        diretamente pelo estado.
    */

    document.getElementById(
        "anticipatedMonths"
    ).textContent =
        number(
            state.anticipatedMonths
        );


    /*
        Prazo restante.
    */

    document.getElementById(
        "remainingTerm"
    ).textContent =
        `${number(
            calculateRemainingTerm()
        )} meses`;


    /*
        Próxima prestação.
    */

    document.getElementById(
        "nextInstallment"
    ).textContent =
        formatDate(
            state.nextPaymentDate
        );


    /*
        Percentual.
    */

    document.getElementById(
        "progressPercent"
    ).textContent =
        `${progress.toFixed(1)}%`;


    /*
        Barra.
    */

    document.getElementById(
        "progressFill"
    ).style.width =
        `${progress}%`;


    /*
        Histórico.
    */

    renderTransactions();

}


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

updateDashboard();