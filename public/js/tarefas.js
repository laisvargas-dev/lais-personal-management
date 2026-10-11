
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  let tarefas = [];
  let avisoTimer = null;

  function mensagem(texto, erro = false) {
    const elemento = $("message");
    elemento.textContent = texto;
    elemento.className = erro ? "message error" : "message";
    elemento.hidden = false;

    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => {
      elemento.hidden = true;
    }, 5000);
  }

  async function api(url, opcoes = {}) {
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

  function hojeLocal() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const dia = String(agora.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function atrasada(tarefa) {
    return !tarefa.concluida &&
      !!tarefa.data_limite &&
      tarefa.data_limite < hojeLocal();
  }

  function formatarData(data) {
    if (!data) return "Sem prazo";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  async function carregarTarefas() {
    try {
      tarefas = await api("/api/tarefas");
      renderizar();
    } catch (erro) {
      mensagem(erro.message, true);
    }
  }

  function renderizar() {
    const total = tarefas.length;
    const concluidas = tarefas.filter(t => t.concluida).length;
    const pendentes = total - concluidas;
    const atrasadas = tarefas.filter(atrasada).length;
    const percentual = total
      ? Math.round(concluidas / total * 100)
      : 0;

    $("totalTasks").textContent = total;
    $("pendingTasks").textContent = pendentes;
    $("completedTasks").textContent = concluidas;
    $("overdueTasks").textContent = atrasadas;
    $("progressPercentage").textContent = `${percentual}%`;
    $("progressFill").style.width = `${percentual}%`;

    renderizarLista();
  }

  function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function renderizarLista() {
    const busca = $("searchInput").value.trim().toLowerCase();
    const status = $("statusFilter").value;
    const prioridade = $("priorityFilter").value;

    const filtradas = tarefas.filter(tarefa => {
      const conteudo = (
        `${tarefa.titulo} ${tarefa.descricao || ""}`
      ).toLowerCase();

      const correspondeStatus =
        !status ||
        (status === "pendente" && !tarefa.concluida) ||
        (status === "concluida" && tarefa.concluida) ||
        (status === "atrasada" && atrasada(tarefa));

      return conteudo.includes(busca) &&
        correspondeStatus &&
        (!prioridade || tarefa.prioridade === prioridade);
    });

    const lista = $("tasksList");
    lista.replaceChildren();

    if (!filtradas.length) {
      lista.appendChild(
        criarElemento(
          "p",
          "empty",
          "Nenhuma tarefa encontrada. ♡"
        )
      );
      return;
    }

    filtradas.forEach(tarefa => {
      const item = criarElemento(
        "article",
        `task-item ${tarefa.concluida ? "completed" : ""}`
      );

      const check = criarElemento("input", "task-check");
      check.type = "checkbox";
      check.checked = tarefa.concluida;
      check.setAttribute(
        "aria-label",
        `Marcar ${tarefa.titulo} como concluída`
      );

      check.addEventListener("change", async () => {
        check.disabled = true;

        try {
          await api(`/api/tarefas/${tarefa.id}/concluir`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ concluida: check.checked })
          });

          await carregarTarefas();
          mensagem("Status da tarefa atualizado! ♡");
        } catch (erro) {
          check.checked = tarefa.concluida;
          mensagem(erro.message, true);
        } finally {
          check.disabled = false;
        }
      });

      const conteudo = criarElemento("div", "task-content");
      const titulo = criarElemento("h3", "task-title", tarefa.titulo);
      conteudo.appendChild(titulo);

      if (tarefa.descricao) {
        conteudo.appendChild(
          criarElemento(
            "p",
            "task-description",
            tarefa.descricao
          )
        );
      }

      const meta = criarElemento("div", "task-meta");

      const prioridade = criarElemento(
        "span",
        `priority ${tarefa.prioridade}`,
        `Prioridade ${
          tarefa.prioridade === "media"
            ? "média"
            : tarefa.prioridade
        }`
      );

      const status = criarElemento(
        "span",
        `status ${tarefa.concluida ? "done" : "pending"}`,
        tarefa.concluida ? "✓ Concluída" : "◷ Pendente"
      );

      const prazo = criarElemento(
        "span",
        `deadline ${atrasada(tarefa) ? "overdue" : ""}`,
        atrasada(tarefa)
          ? `⚠ Atrasada: ${formatarData(tarefa.data_limite)}`
          : `▦ ${formatarData(tarefa.data_limite)}`
      );

      meta.append(prioridade, status, prazo);
      conteudo.appendChild(meta);

      const acoes = criarElemento("div", "task-actions");

      const editar = criarElemento("button", "", "Editar");
      editar.type = "button";
      editar.addEventListener("click", () => abrirModal(tarefa));

      const excluir = criarElemento("button", "danger", "Excluir");
      excluir.type = "button";
      excluir.addEventListener("click", () => excluirTarefa(tarefa));

      acoes.append(editar, excluir);
      item.append(check, conteudo, acoes);
      lista.appendChild(item);
    });
  }

  function abrirModal(tarefa = null) {
    $("taskForm").reset();

    $("taskId").value = tarefa?.id || "";
    $("taskTitle").value = tarefa?.titulo || "";
    $("taskDescription").value = tarefa?.descricao || "";
    $("taskPriority").value = tarefa?.prioridade || "media";
    $("taskDeadline").value = tarefa?.data_limite || "";
    $("taskCompleted").checked = tarefa?.concluida || false;

    $("modalTitle").textContent = tarefa
      ? "Editar tarefa ♡"
      : "Nova tarefa ♡";

    $("taskModal").hidden = false;
    $("taskTitle").focus();
  }

  function fecharModal() {
    $("taskModal").hidden = true;
    $("taskForm").reset();
  }

  async function salvarTarefa(evento) {
    evento.preventDefault();

    const id = $("taskId").value;
    const botao = $("saveTaskBtn");

    const dados = {
      titulo: $("taskTitle").value.trim(),
      descricao: $("taskDescription").value.trim(),
      prioridade: $("taskPriority").value,
      data_limite: $("taskDeadline").value || null,
      concluida: $("taskCompleted").checked
    };

    if (!dados.titulo) {
      mensagem("Informe o título da tarefa.", true);
      return;
    }

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      await api(
        id ? `/api/tarefas/${id}` : "/api/tarefas",
        {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dados)
        }
      );

      fecharModal();
      await carregarTarefas();

      mensagem(
        id
          ? "Tarefa atualizada com sucesso! ♡"
          : "Tarefa cadastrada com sucesso! ♡"
      );
    } catch (erro) {
      mensagem(erro.message, true);
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar tarefa";
    }
  }

  async function excluirTarefa(tarefa) {
    if (!confirm(`Deseja excluir "${tarefa.titulo}"?`)) return;

    try {
      await api(`/api/tarefas/${tarefa.id}`, {
        method: "DELETE"
      });

      await carregarTarefas();
      mensagem("Tarefa excluída com sucesso!");
    } catch (erro) {
      mensagem(erro.message, true);
    }
  }

  async function sair() {
    try {
      await api("/api/auth/logout", {
        method: "POST"
      });

      window.location.replace("/pages/login.html");
    } catch (erro) {
      mensagem(erro.message, true);
    }
  }

  $("addTaskBtn").addEventListener("click", () => abrirModal());
  $("secondaryAddBtn").addEventListener("click", () => abrirModal());

  $("closeModal").addEventListener("click", fecharModal);
  $("cancelModal").addEventListener("click", fecharModal);

  $("taskModal").addEventListener("click", evento => {
    if (evento.target === $("taskModal")) {
      fecharModal();
    }
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") fecharModal();
  });

  $("taskForm").addEventListener("submit", salvarTarefa);

  $("searchInput").addEventListener("input", renderizarLista);
  $("statusFilter").addEventListener("change", renderizarLista);
  $("priorityFilter").addEventListener("change", renderizarLista);

  $("clearFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("statusFilter").value = "";
    $("priorityFilter").value = "";
    renderizarLista();
  });

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", sair);

  carregarTarefas();
});
