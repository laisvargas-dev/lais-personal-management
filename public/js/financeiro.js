
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  let transacoes = [];
  let grafico = null;
  let mensagemTimer = null;

  const moeda = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  const dataLocal = () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };

  function mostrarMensagem(texto, erro = false) {
    const elemento = $("message");
    elemento.textContent = texto;
    elemento.className = erro ? "message error" : "message";
    elemento.hidden = false;

    clearTimeout(mensagemTimer);
    mensagemTimer = setTimeout(() => {
      elemento.hidden = true;
    }, 5000);
  }

  async function requisicao(url, opcoes = {}) {
    const resposta = await fetch(url, {
      credentials: "same-origin",
      ...opcoes
    });

    if (resposta.status === 401) {
      window.location.replace("/pages/login.html");
      throw new Error("Sua sessão expirou.");
    }

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível concluir a operação."
      );
    }

    return dados;
  }

  function abrirModal(transacao = null) {
    $("transactionForm").reset();

    $("transactionId").value = transacao?.id || "";
    $("modalTitle").textContent = transacao
      ? "Editar movimentação ♡"
      : "Nova movimentação ♡";

    $("transactionType").value = transacao?.tipo || "despesa";
    $("description").value = transacao?.descricao || "";
    $("amount").value = transacao?.valor || "";
    $("transactionDate").value = transacao?.data || dataLocal();

    $("transactionModal").hidden = false;
    $("description").focus();
  }

  function fecharModal() {
    $("transactionModal").hidden = true;
    $("transactionForm").reset();
  }

  async function carregarDados() {
    try {
      const [lista, resumo] = await Promise.all([
        requisicao("/api/financeiro/transacoes"),
        requisicao("/api/financeiro/resumo")
      ]);

      transacoes = lista;

      $("saldo").textContent = moeda(resumo.saldo);
      $("receitas").textContent = moeda(resumo.receitas);
      $("despesas").textContent = moeda(resumo.despesas);

      renderizarTabela();
      renderizarGrafico();
    } catch (erro) {
      mostrarMensagem(erro.message, true);
    }
  }

  function formatarData(data) {
    if (!data) return "—";

    const partes = data.slice(0, 10).split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  function renderizarTabela() {
    const pesquisa = $("searchInput").value
      .trim()
      .toLowerCase();

    const tipo = $("typeFilter").value;
    const mes = $("monthFilter").value;

    const filtradas = transacoes.filter((transacao) => {
      const descricao = String(transacao.descricao || "")
        .toLowerCase();

      return (
        descricao.includes(pesquisa) &&
        (!tipo || transacao.tipo === tipo) &&
        (!mes || transacao.data.startsWith(mes))
      );
    });

    const corpo = $("transactionsBody");
    corpo.replaceChildren();

    if (filtradas.length === 0) {
      const linha = document.createElement("tr");
      const celula = document.createElement("td");

      celula.colSpan = 5;
      celula.className = "empty";
      celula.textContent =
        "Nenhuma movimentação encontrada. ♡";

      linha.appendChild(celula);
      corpo.appendChild(linha);
      return;
    }

    filtradas.forEach((transacao) => {
      const linha = document.createElement("tr");

      const descricao = document.createElement("td");
      descricao.textContent = transacao.descricao;

      const tipo = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge ${transacao.tipo}`;
      badge.textContent =
        transacao.tipo === "receita" ? "Receita" : "Despesa";
      tipo.appendChild(badge);

      const data = document.createElement("td");
      data.textContent = formatarData(transacao.data);

      const valor = document.createElement("td");
      valor.className = `value ${transacao.tipo}`;
      valor.textContent =
        (transacao.tipo === "receita" ? "+ " : "- ") +
        moeda(transacao.valor);

      const acoes = document.createElement("td");

      const editar = document.createElement("button");
      editar.type = "button";
      editar.className = "action-button";
      editar.textContent = "Editar";
      editar.addEventListener("click", () => {
        abrirModal(transacao);
      });

      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "action-button delete";
      excluir.textContent = "Excluir";
      excluir.addEventListener("click", () => {
        excluirTransacao(transacao);
      });

      acoes.append(editar, excluir);
      linha.append(descricao, tipo, data, valor, acoes);
      corpo.appendChild(linha);
    });
  }

  async function salvarTransacao(evento) {
    evento.preventDefault();

    const id = $("transactionId").value;
    const botao = $("saveBtn");

    const dados = {
      tipo: $("transactionType").value,
      descricao: $("description").value.trim(),
      valor: Number($("amount").value),
      data: $("transactionDate").value,
      categoria_id: null
    };

    if (!dados.descricao || dados.valor <= 0 || !dados.data) {
      mostrarMensagem("Preencha todos os campos.", true);
      return;
    }

    const url = id
      ? `/api/financeiro/transacoes/${id}`
      : "/api/financeiro/transacoes";

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      await requisicao(url, {
        method: id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dados)
      });

      fecharModal();
      await carregarDados();

      mostrarMensagem(
        id
          ? "Movimentação atualizada com sucesso! ♡"
          : "Movimentação cadastrada com sucesso! ♡"
      );
    } catch (erro) {
      mostrarMensagem(erro.message, true);
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar movimentação";
    }
  }

  async function excluirTransacao(transacao) {
    const confirmado = confirm(
      `Deseja excluir "${transacao.descricao}"?`
    );

    if (!confirmado) return;

    try {
      await requisicao(
        `/api/financeiro/transacoes/${transacao.id}`,
        { method: "DELETE" }
      );

      await carregarDados();
      mostrarMensagem("Movimentação excluída com sucesso!");
    } catch (erro) {
      mostrarMensagem(erro.message, true);
    }
  }

  function renderizarGrafico() {
    if (typeof Chart === "undefined") {
      mostrarMensagem(
        "A biblioteca de gráficos não foi carregada.",
        true
      );
      return;
    }

    const meses = [];

    for (let i = 5; i >= 0; i--) {
      const data = new Date();
      data.setDate(1);
      data.setMonth(data.getMonth() - i);

      const chave =
        data.getFullYear() + "-" +
        String(data.getMonth() + 1).padStart(2, "0");

      meses.push({
        chave,
        nome: data.toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit"
        })
      });
    }

    const receitas = meses.map((mes) =>
      transacoes
        .filter((t) =>
          t.tipo === "receita" &&
          t.data.startsWith(mes.chave)
        )
        .reduce((soma, t) => soma + Number(t.valor), 0)
    );

    const despesas = meses.map((mes) =>
      transacoes
        .filter((t) =>
          t.tipo === "despesa" &&
          t.data.startsWith(mes.chave)
        )
        .reduce((soma, t) => soma + Number(t.valor), 0)
    );

    if (grafico) {
      grafico.destroy();
    }

    grafico = new Chart($("financeChart"), {
      type: "bar",
      data: {
        labels: meses.map((mes) => mes.nome),
        datasets: [
          {
            label: "Receitas",
            data: receitas,
            backgroundColor: "#ec4899",
            borderRadius: 8
          },
          {
            label: "Despesas",
            data: despesas,
            backgroundColor: "#f9a8d4",
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (contexto) =>
                `${contexto.dataset.label}: ${moeda(contexto.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (valor) => moeda(valor)
            }
          }
        }
      }
    });
  }

  async function sair() {
    try {
      const resposta = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin"
      });

      if (!resposta.ok) {
        throw new Error("Não foi possível sair da conta.");
      }

      window.location.replace("/pages/login.html");
    } catch (erro) {
      mostrarMensagem(erro.message, true);
    }
  }

  $("addBtn").addEventListener("click", () => abrirModal());
  $("quickAddBtn").addEventListener("click", () => abrirModal());
  $("historyAddBtn").addEventListener("click", () => abrirModal());

  $("closeModal").addEventListener("click", fecharModal);
  $("cancelModal").addEventListener("click", fecharModal);

  $("transactionModal").addEventListener("click", (evento) => {
    if (evento.target === $("transactionModal")) {
      fecharModal();
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") fecharModal();
  });

  $("transactionForm").addEventListener(
    "submit",
    salvarTransacao
  );

  $("searchInput").addEventListener("input", renderizarTabela);
  $("typeFilter").addEventListener("change", renderizarTabela);
  $("monthFilter").addEventListener("change", renderizarTabela);

  $("clearFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("typeFilter").value = "";
    $("monthFilter").value = "";
    renderizarTabela();
  });

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", sair);

  carregarDados();
});
