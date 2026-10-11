
document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  let metas = [];
  let avisoTimer = null;

  const categorias = {
    pessoal: { nome: "Pessoal", icone: "♡" },
    financeira: { nome: "Financeira", icone: "💰" },
    estudos: { nome: "Estudos", icone: "📚" },
    profissional: { nome: "Profissional", icone: "💻" },
    saude: { nome: "Saúde", icone: "🌿" },
    outras: { nome: "Outras", icone: "✦" }
  };

  function mensagem(texto, erro = false) {
    const el = $("message");
    el.textContent = texto;
    el.className = erro ? "message error" : "message";
    el.hidden = false;

    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => {
      el.hidden = true;
    }, 5000);
  }

  async function api(url, opcoes = {}) {
    const resposta = await fetch(url, {
      credentials: "same-origin",
      ...opcoes
    });

    if (resposta.status === 401) {
      window.location.replace("/pages/login.html");
      throw new Error("Faça login novamente.");
    }

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      throw new Error(
        dados.mensagem || "Não foi possível concluir a operação."
      );
    }

    return dados;
  }

  function elemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function hojeLocal() {
    const data = new Date();
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function atrasada(meta) {
    return !meta.concluida &&
      Boolean(meta.prazo) &&
      meta.prazo < hojeLocal();
  }

  function formatarData(data) {
    if (!data) return "Sem prazo";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  async function carregarMetas() {
    try {
      metas = await api("/api/metas");
      renderizar();
    } catch (erro) {
      mensagem(erro.message, true);
    }
  }

  function renderizar() {
    const total = metas.length;
    const concluidas = metas.filter(m => m.concluida).length;
    const ativas = total - concluidas;
    const media = total
      ? Math.round(
          metas.reduce((soma, m) => soma + Number(m.progresso), 0) / total
        )
      : 0;

    $("totalGoals").textContent = total;
    $("activeGoals").textContent = ativas;
    $("completedGoals").textContent = concluidas;
    $("averageProgress").textContent = `${media}%`;
    $("overviewPercent").textContent = `${media}%`;
    $("overviewFill").style.width = `${media}%`;

    renderizarMetas();
  }

  function renderizarMetas() {
    const busca = $("searchGoals").value.trim().toLowerCase();
    const categoria = $("categoryFilter").value;
    const situacao = $("statusFilter").value;

    const filtradas = metas.filter(meta => {
      const texto = `${meta.titulo} ${meta.descricao || ""}`.toLowerCase();

      const correspondeSituacao =
        !situacao ||
        (situacao === "ativa" && !meta.concluida) ||
        (situacao === "concluida" && meta.concluida) ||
        (situacao === "atrasada" && atrasada(meta));

      return texto.includes(busca) &&
        (!categoria || meta.categoria === categoria) &&
        correspondeSituacao;
    });

    const grade = $("goalsGrid");
    grade.replaceChildren();

    if (!filtradas.length) {
      grade.appendChild(
        elemento("p", "empty", "Nenhuma meta encontrada. ♡")
      );
      return;
    }

    filtradas.forEach(meta => {
      const info = categorias[meta.categoria] || categorias.outras;
      const progresso = Number(meta.progresso);

      const card = elemento("article", "goal-card");

      const cabecalho = elemento("div", "goal-header");
      const icone = elemento("div", "goal-icon", info.icone);
      const acoes = elemento("div", "goal-actions");

      const editar = elemento("button", "", "Editar");
      editar.type = "button";
      editar.addEventListener("click", () => abrirModal(meta));

      const excluir = elemento("button", "danger", "Excluir");
      excluir.type = "button";
      excluir.addEventListener("click", () => excluirMeta(meta));

      acoes.append(editar, excluir);
      cabecalho.append(icone, acoes);

      const titulo = elemento("h3", "", meta.titulo);
      const descricao = elemento(
        "p",
        "goal-description",
        meta.descricao || "Cada passo importa. ♡"
      );

      const etiquetas = elemento("div", "goal-meta");
      etiquetas.appendChild(
        elemento("span", "goal-tag", info.nome)
      );

      etiquetas.appendChild(
        elemento(
          "span",
          `goal-tag ${meta.concluida ? "success" : ""}`,
          meta.concluida ? "✓ Conquistada" : "◷ Em andamento"
        )
      );

      etiquetas.appendChild(
        elemento(
          "span",
          `goal-tag ${atrasada(meta) ? "overdue" : ""}`,
          atrasada(meta)
            ? `⚠ Atrasada: ${formatarData(meta.prazo)}`
            : `▦ ${formatarData(meta.prazo)}`
        )
      );

      const tituloProgresso = elemento("div", "goal-progress-heading");
      tituloProgresso.append(
        elemento("span", "", "Progresso da meta"),
        elemento("strong", "", `${progresso}%`)
      );

      const barra = elemento("div", "progress-track");
      const preenchimento = elemento("div", "progress-fill");
      preenchimento.style.width = `${progresso}%`;
      barra.appendChild(preenchimento);

      const controle = elemento("div", "goal-progress-control");
      const rotulo = elemento("label", "", "Atualizar progresso");
      const slider = elemento("input");
      const idSlider = `progress-${meta.id}`;

      slider.id = idSlider;
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.step = "1";
      slider.value = String(progresso);
      rotulo.htmlFor = idSlider;

      const valor = elemento("strong", "", `${progresso}%`);
      slider.addEventListener("input", () => {
        valor.textContent = `${slider.value}%`;
      });

      slider.addEventListener("change", async () => {
        slider.disabled = true;

        try {
          await api(`/api/metas/${meta.id}/progresso`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              progresso: Number(slider.value)
            })
          });

          await carregarMetas();
          mensagem("Progresso atualizado! ♡");
        } catch (erro) {
          slider.value = String(progresso);
          valor.textContent = `${progresso}%`;
          mensagem(erro.message, true);
        } finally {
          slider.disabled = false;
        }
      });

      controle.append(rotulo, slider, valor);

      card.append(
        cabecalho,
        titulo,
        descricao,
        etiquetas,
        tituloProgresso,
        barra,
        controle
      );

      grade.appendChild(card);
    });
  }

  function abrirModal(meta = null) {
    $("goalForm").reset();

    $("goalId").value = meta?.id || "";
    $("goalTitle").value = meta?.titulo || "";
    $("goalCategory").value = meta?.categoria || "pessoal";
    $("goalDescription").value = meta?.descricao || "";
    $("goalDeadline").value = meta?.prazo || "";
    $("goalProgress").value = meta?.progresso ?? 0;

    $("progressValue").textContent = `${$("goalProgress").value}%`;
    $("modalTitle").textContent = meta
      ? "Editar meta ♡"
      : "Nova meta ♡";

    $("goalModal").hidden = false;
    $("goalTitle").focus();
  }

  function fecharModal() {
    $("goalModal").hidden = true;
    $("goalForm").reset();
  }

  async function salvarMeta(evento) {
    evento.preventDefault();

    const id = $("goalId").value;
    const botao = $("saveGoalBtn");

    const dados = {
      titulo: $("goalTitle").value.trim(),
      categoria: $("goalCategory").value,
      descricao: $("goalDescription").value.trim(),
      prazo: $("goalDeadline").value || null,
      progresso: Number($("goalProgress").value)
    };

    if (!dados.titulo) {
      mensagem("Informe o nome da meta.", true);
      return;
    }

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      await api(id ? `/api/metas/${id}` : "/api/metas", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados)
      });

      fecharModal();
      await carregarMetas();

      mensagem(
        id
          ? "Meta atualizada com sucesso! ♡"
          : "Nova meta cadastrada! ♡"
      );
    } catch (erro) {
      mensagem(erro.message, true);
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar meta";
    }
  }

  async function excluirMeta(meta) {
    if (!confirm(`Deseja excluir a meta "${meta.titulo}"?`)) {
      return;
    }

    try {
      await api(`/api/metas/${meta.id}`, {
        method: "DELETE"
      });

      await carregarMetas();
      mensagem("Meta excluída com sucesso!");
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

  $("addGoalBtn").addEventListener("click", () => abrirModal());
  $("addGoalSecondary").addEventListener("click", () => abrirModal());

  $("closeModal").addEventListener("click", fecharModal);
  $("cancelModal").addEventListener("click", fecharModal);

  $("goalModal").addEventListener("click", evento => {
    if (evento.target === $("goalModal")) {
      fecharModal();
    }
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") fecharModal();
  });

  $("goalProgress").addEventListener("input", () => {
    $("progressValue").textContent = `${$("goalProgress").value}%`;
  });

  $("goalForm").addEventListener("submit", salvarMeta);
  $("searchGoals").addEventListener("input", renderizarMetas);
  $("categoryFilter").addEventListener("change", renderizarMetas);
  $("statusFilter").addEventListener("change", renderizarMetas);

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", sair);

  carregarMetas();
});
