
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  let graficoFinanceiro = null;
  let carregando = false;

  const moeda = (valor) => {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

  const numero = (valor) => {
    return Number(valor || 0).toLocaleString("pt-BR");
  };

  function mostrarErro(mensagem) {
    const elemento = $("errorMessage");

    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.hidden = false;
  }

  function limparErro() {
    const elemento = $("errorMessage");

    if (!elemento) return;

    elemento.textContent = "";
    elemento.hidden = true;
  }

  function atualizarTexto(id, valor) {
    const elemento = $(id);

    if (elemento) {
      elemento.textContent = valor;
    }
  }

  function atualizarData() {
    const data = new Date();

    const texto = data.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    atualizarTexto(
      "todayDate",
      texto.charAt(0).toUpperCase() + texto.slice(1)
    );
  }

  function formatarDataBanco(valor) {
    if (!valor) {
      return "Sem prazo definido";
    }

    // Datas recebidas como YYYY-MM-DD não devem
    // sofrer alterações por causa do fuso horário.
    const texto = String(valor);

    const correspondencia = texto.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

    if (correspondencia) {
      const [, ano, mes, dia] = correspondencia;
      return `${dia}/${mes}/${ano}`;
    }

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
      return "Prazo não informado";
    }

    return data.toLocaleDateString("pt-BR");
  }

  function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);

    if (classe) {
      elemento.className = classe;
    }

    if (texto !== undefined) {
      elemento.textContent = texto;
    }

    return elemento;
  }

  function atualizarUsuario(usuario) {
    const nomeCompleto = String(
      usuario?.nome || "Usuária"
    ).trim();

    const primeiroNome = nomeCompleto.split(/\s+/)[0];

    atualizarTexto("userName", primeiroNome);
    atualizarTexto("profileName", nomeCompleto);

    atualizarTexto(
      "avatar",
      primeiroNome.charAt(0).toUpperCase() || "L"
    );
  }

  function atualizarIndicadores(dados) {
    const financeiro = dados.financeiro || {};

    atualizarTexto(
      "saldo",
      moeda(financeiro.saldo)
    );

    atualizarTexto(
      "receitas",
      moeda(financeiro.receitasMes)
    );

    atualizarTexto(
      "despesas",
      moeda(financeiro.despesasMes)
    );

    atualizarTexto(
      "tarefas",
      numero(dados.tarefasPendentes)
    );

    atualizarTexto(
      "eventos",
      numero(dados.compromissosHoje)
    );

    atualizarTexto(
      "estudos",
      numero(dados.horasEstudadas) + "h"
    );

    atualizarTexto(
      "metas",
      numero(dados.metasAndamento)
    );
  }

  function renderizarTarefas(tarefas) {
    const lista = $("taskList");

    if (!lista) return;

    lista.replaceChildren();

    if (!Array.isArray(tarefas) || tarefas.length === 0) {
      lista.appendChild(
        criarElemento(
          "p",
          "empty",
          "Nenhuma tarefa pendente. ♡"
        )
      );

      return;
    }

    tarefas.forEach((tarefa) => {
      const item = criarElemento(
        "div",
        "task-item"
      );

      const ponto = criarElemento(
        "span",
        "task-dot"
      );

      const informacoes = criarElemento("div");

      const titulo = criarElemento(
        "strong",
        "",
        tarefa.titulo || "Tarefa sem título"
      );

      const prazo = criarElemento(
        "p",
        "",
        tarefa.data_limite
          ? `Prazo: ${formatarDataBanco(tarefa.data_limite)}`
          : "Sem prazo definido"
      );

      informacoes.append(titulo, prazo);

      item.append(ponto, informacoes);

      lista.appendChild(item);
    });
  }

  function prepararMeses() {
    const meses = [];
    const hoje = new Date();

    for (let i = 5; i >= 0; i--) {
      const data = new Date(
        hoje.getFullYear(),
        hoje.getMonth() - i,
        1
      );

      const chave = [
        data.getFullYear(),
        String(data.getMonth() + 1).padStart(2, "0")
      ].join("-");

      const nome = data.toLocaleDateString(
        "pt-BR",
        { month: "short" }
      );

      meses.push({
        chave,
        nome
      });
    }

    return meses;
  }

  function renderizarGrafico(registros) {
    const canvas = $("financeChart");

    if (!canvas) return;

    if (typeof Chart === "undefined") {
      mostrarErro(
        "Não foi possível carregar a biblioteca de gráficos."
      );

      return;
    }

    const meses = prepararMeses();

    const registrosPorMes = new Map(
      (Array.isArray(registros) ? registros : [])
        .map((registro) => [
          registro.mes,
          registro
        ])
    );

    const receitas = meses.map((mes) => {
      const registro = registrosPorMes.get(mes.chave);

      return Number(registro?.receitas || 0);
    });

    const despesas = meses.map((mes) => {
      const registro = registrosPorMes.get(mes.chave);

      return Number(registro?.despesas || 0);
    });

    if (graficoFinanceiro) {
      graficoFinanceiro.destroy();
      graficoFinanceiro = null;
    }

    graficoFinanceiro = new Chart(canvas, {
      type: "bar",

      data: {
        labels: meses.map((mes) => mes.nome),

        datasets: [
          {
            label: "Receitas",
            data: receitas,
            backgroundColor: "#ec4899",
            borderRadius: 8,
            maxBarThickness: 38
          },
          {
            label: "Despesas",
            data: despesas,
            backgroundColor: "#f9a8d4",
            borderRadius: 8,
            maxBarThickness: 38
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          intersect: false,
          mode: "index"
        },

        plugins: {
          legend: {
            position: "bottom",

            labels: {
              usePointStyle: true,
              padding: 20
            }
          },

          tooltip: {
            callbacks: {
              label: (contexto) => {
                return (
                  contexto.dataset.label +
                  ": " +
                  moeda(contexto.parsed.y)
                );
              }
            }
          }
        },

        scales: {
          x: {
            grid: {
              display: false
            },

            ticks: {
              color: "#918597"
            }
          },

          y: {
            beginAtZero: true,

            ticks: {
              color: "#918597",

              callback: (valor) => moeda(valor)
            },

            grid: {
              color: "#f6e8f0"
            }
          }
        }
      }
    });
  }

  async function carregarDashboard() {
    if (carregando) return;

    carregando = true;
    limparErro();

    try {
      const resposta = await fetch(
        "/api/dashboard/resumo",
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store"
        }
      );

      if (resposta.status === 401) {
        window.location.replace(
          "/pages/login.html"
        );

        return;
      }

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível carregar o Dashboard."
        );
      }

      const dados = await resposta.json();

      atualizarUsuario(dados.usuario);
      atualizarIndicadores(dados);

      renderizarTarefas(
        dados.proximasTarefas
      );

      renderizarGrafico(
        dados.grafico
      );

      atualizarData();

    } catch (erro) {
      console.error(
        "Erro ao carregar Dashboard:",
        erro
      );

      mostrarErro(
        erro.message ||
        "Ocorreu um erro inesperado."
      );

    } finally {
      carregando = false;
    }
  }

  async function sairDaConta() {
    const botao = $("logoutBtn");

    if (botao) {
      botao.disabled = true;
    }

    try {
      const resposta = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "same-origin"
        }
      );

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível sair da conta."
        );
      }

      window.location.replace(
        "/pages/login.html"
      );

    } catch (erro) {
      mostrarErro(erro.message);

      if (botao) {
        botao.disabled = false;
      }
    }
  }

  function configurarMenu() {
    const botao = $("menuBtn");
    const sidebar = $("sidebar");

    if (!botao || !sidebar) return;

    botao.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") {
        sidebar.classList.remove("open");
      }
    });
  }

  function configurarAtualizacao() {
    // Atualiza os indicadores quando a usuária
    // volta para a aba do Dashboard.
    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          carregarDashboard();
        }
      }
    );

    window.addEventListener("pageshow", (evento) => {
      if (evento.persisted) {
        carregarDashboard();
      }
    });
  }

  atualizarData();
  configurarMenu();
  configurarAtualizacao();

  $("logoutBtn")?.addEventListener(
    "click",
    sairDaConta
  );

  carregarDashboard();
});
