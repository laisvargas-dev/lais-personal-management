
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  let materias = [];
  let sessoes = [];
  let grafico = null;
  let timerInterval = null;
  let tempoAcumulado = 0;
  let inicioContagem = null;
  let materiaEmAndamento = null;
  let avisoTimer = null;

  function mensagem(texto, erro = false) {
    const el = $("message");
    el.textContent = texto;
    el.className = erro ? "message error" : "message";
    el.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => el.hidden = true, 5000);
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
      throw new Error(dados.mensagem || "Erro na operação.");
    }

    return dados;
  }

  function formatoHoras(minutos) {
    const horas = minutos / 60;
    return `${Number(horas.toFixed(1)).toLocaleString("pt-BR")}h`;
  }

  function chaveData(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function inicioDaSemana() {
    const data = new Date();
    const dia = (data.getDay() + 6) % 7;
    data.setDate(data.getDate() - dia);
    data.setHours(0, 0, 0, 0);
    return data;
  }

  function minutosNaSemana(materiaId = null) {
    const inicio = inicioDaSemana();

    return sessoes
      .filter(s => {
        const data = new Date(s.inicio);
        return data >= inicio &&
          (!materiaId || Number(s.materia_id) === Number(materiaId));
      })
      .reduce((total, s) => total + Number(s.duracao_minutos), 0);
  }

  async function carregarDados() {
    try {
      const [listaMaterias, listaSessoes] = await Promise.all([
        api("/api/estudos/materias"),
        api("/api/estudos/sessoes")
      ]);

      materias = listaMaterias;
      sessoes = listaSessoes;

      renderizar();
    } catch (erro) {
      mensagem(erro.message, true);
    }
  }

  function renderizar() {
    $("subjectCount").textContent = materias.length;
    $("weekHours").textContent = formatoHoras(minutosNaSemana());

    const meta = materias.reduce(
      (total, m) => total + Number(m.meta_horas_semanais || 0),
      0
    );
    $("weeklyGoal").textContent = `${meta.toLocaleString("pt-BR")}h`;

    renderizarMaterias();
    renderizarSeletor();
    renderizarHistorico();
    renderizarGrafico();
  }

  function renderizarMaterias() {
    const grade = $("subjectsGrid");
    grade.replaceChildren();

    if (!materias.length) {
      const vazio = document.createElement("p");
      vazio.className = "empty";
      vazio.textContent =
        "Nenhuma matéria cadastrada. Adicione sua primeira matéria! ♡";
      grade.appendChild(vazio);
      return;
    }

    materias.forEach(m => {
      const meta = Number(m.meta_horas_semanais || 0);
      const estudado = minutosNaSemana(m.id) / 60;
      const percentual = meta > 0
        ? Math.min(100, estudado / meta * 100)
        : 0;

      const card = document.createElement("article");
      card.className = "subject-card";

      const topo = document.createElement("div");
      topo.className = "subject-top";

      const titulo = document.createElement("h3");
      titulo.textContent = `✦ ${m.nome}`;

      const acoes = document.createElement("div");
      acoes.className = "subject-actions";

      const editar = document.createElement("button");
      editar.type = "button";
      editar.textContent = "Editar";
      editar.addEventListener("click", () => abrirModal(m));

      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "danger";
      excluir.textContent = "Excluir";
      excluir.addEventListener("click", () => excluirMateria(m));

      acoes.append(editar, excluir);
      topo.append(titulo, acoes);

      const descricao = document.createElement("p");
      descricao.textContent = `Meta semanal: ${meta.toLocaleString("pt-BR")} horas`;

      const barra = document.createElement("div");
      barra.className = "progress-track";

      const progresso = document.createElement("div");
      progresso.className = "progress-fill";
      progresso.style.width = `${percentual}%`;
      barra.appendChild(progresso);

      const rodape = document.createElement("div");
      rodape.className = "progress-label";

      const horas = document.createElement("span");
      horas.textContent = `${formatoHoras(estudado * 60)} estudadas`;

      const porcentagem = document.createElement("span");
      porcentagem.textContent = `${Math.round(percentual)}% da meta`;

      rodape.append(horas, porcentagem);
      card.append(topo, descricao, barra, rodape);
      grade.appendChild(card);
    });
  }

  function renderizarSeletor() {
    const seletor = $("timerSubject");
    const anterior = seletor.value;
    seletor.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione uma matéria";
    seletor.appendChild(placeholder);

    materias.forEach(m => {
      const opcao = document.createElement("option");
      opcao.value = m.id;
      opcao.textContent = m.nome;
      seletor.appendChild(opcao);
    });

    seletor.value = materias.some(m => String(m.id) === anterior)
      ? anterior
      : "";

    if (materiaEmAndamento !== null) {
      seletor.value = String(materiaEmAndamento);
    }
  }

  function renderizarHistorico() {
    const corpo = $("sessionsBody");
    corpo.replaceChildren();

    if (!sessoes.length) {
      const linha = document.createElement("tr");
      const celula = document.createElement("td");
      celula.colSpan = 5;
      celula.className = "empty";
      celula.textContent = "Nenhuma sessão registrada ainda. ♡";
      linha.appendChild(celula);
      corpo.appendChild(linha);
      return;
    }

    sessoes.forEach(s => {
      const linha = document.createElement("tr");

      const materia = document.createElement("td");
      materia.textContent = s.materia;

      const data = document.createElement("td");
      data.textContent = new Date(s.inicio).toLocaleString("pt-BR");

      const duracao = document.createElement("td");
      duracao.textContent = `${s.duracao_minutos} min`;

      const observacoes = document.createElement("td");
      observacoes.textContent = s.observacoes || "—";

      const acoes = document.createElement("td");
      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "table-action danger";
      excluir.textContent = "Excluir";
      excluir.addEventListener("click", () => excluirSessao(s));
      acoes.appendChild(excluir);

      linha.append(materia, data, duracao, observacoes, acoes);
      corpo.appendChild(linha);
    });
  }

  function renderizarGrafico() {
    if (typeof Chart === "undefined") {
      mensagem("Não foi possível carregar o gráfico.", true);
      return;
    }

    const dias = [];

    for (let i = 6; i >= 0; i--) {
      const data = new Date();
      data.setDate(data.getDate() - i);

      dias.push({
        chave: chaveData(data),
        nome: data.toLocaleDateString("pt-BR", {
          weekday: "short",
          day: "2-digit"
        })
      });
    }

    const valores = dias.map(dia =>
      sessoes
        .filter(s => chaveData(new Date(s.inicio)) === dia.chave)
        .reduce((total, s) => total + Number(s.duracao_minutos), 0) / 60
    );

    if (grafico) grafico.destroy();

    grafico = new Chart($("studyChart"), {
      type: "bar",
      data: {
        labels: dias.map(d => d.nome),
        datasets: [{
          label: "Horas estudadas",
          data: valores,
          backgroundColor: "#ec4899",
          borderRadius: 9
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: valor => `${valor}h` }
          }
        }
      }
    });
  }

  function abrirModal(materia = null) {
    $("subjectForm").reset();
    $("subjectId").value = materia?.id || "";
    $("subjectName").value = materia?.nome || "";
    $("subjectGoal").value = materia?.meta_horas_semanais ?? 3;
    $("modalTitle").textContent = materia
      ? "Editar matéria ♡"
      : "Nova matéria ♡";

    $("subjectModal").hidden = false;
    $("subjectName").focus();
  }

  function fecharModal() {
    $("subjectModal").hidden = true;
    $("subjectForm").reset();
  }

  async function salvarMateria(evento) {
    evento.preventDefault();

    const id = $("subjectId").value;
    const botao = $("saveSubject");

    const dados = {
      nome: $("subjectName").value.trim(),
      meta_horas_semanais: Number($("subjectGoal").value)
    };

    botao.disabled = true;

    try {
      await api(
        id ? `/api/estudos/materias/${id}` : "/api/estudos/materias",
        {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dados)
        }
      );

      fecharModal();
      await carregarDados();
      mensagem(id ? "Matéria atualizada! ♡" : "Matéria cadastrada! ♡");
    } catch (erro) {
      mensagem(erro.message, true);
    } finally {
      botao.disabled = false;
    }
  }

  async function excluirMateria(materia) {
    if (String(materia.id) === String(materiaEmAndamento)) {
      mensagem("Finalize o cronômetro antes de excluir essa matéria.", true);
      return;
    }

    if (!confirm(`Excluir a matéria "${materia.nome}"?`)) return;

    try {
      await api(`/api/estudos/materias/${materia.id}`, {
        method: "DELETE"
      });
      await carregarDados();
      mensagem("Matéria excluída!");
    } catch (erro) {
      mensagem(erro.message, true);
    }
  }

  async function excluirSessao(sessao) {
    if (!confirm("Excluir esta sessão de estudo?")) return;

    try {
      await api(`/api/estudos/sessoes/${sessao.id}`, {
        method: "DELETE"
      });
      await carregarDados();
      mensagem("Sessão excluída!");
    } catch (erro) {
      mensagem(erro.message, true);
    }
  }

  function segundosDecorridos() {
    const atual = inicioContagem === null
      ? 0
      : Date.now() - inicioContagem;

    return Math.floor((tempoAcumulado + atual) / 1000);
  }

  function atualizarVisor() {
    const total = segundosDecorridos();
    const horas = String(Math.floor(total / 3600)).padStart(2, "0");
    const minutos = String(Math.floor(total % 3600 / 60)).padStart(2, "0");
    const segundos = String(total % 60).padStart(2, "0");

    $("timerDisplay").textContent = `${horas}:${minutos}:${segundos}`;
  }

  function atualizarBotoesTimer() {
    const rodando = inicioContagem !== null;
    const temTempo = tempoAcumulado > 0 || rodando;

    $("startTimer").disabled = rodando;
    $("pauseTimer").disabled = !rodando;
    $("finishTimer").disabled = !temTempo;
    $("timerSubject").disabled = temTempo;
  }

  function iniciarTimer() {
    if (!$("timerSubject").value) {
      mensagem("Selecione uma matéria primeiro.", true);
      return;
    }

    if (inicioContagem !== null) return;

    materiaEmAndamento = $("timerSubject").value;
    inicioContagem = Date.now();

    timerInterval = setInterval(atualizarVisor, 250);
    atualizarVisor();
    atualizarBotoesTimer();
  }

  function pausarTimer() {
    if (inicioContagem === null) return;

    tempoAcumulado += Date.now() - inicioContagem;
    inicioContagem = null;

    clearInterval(timerInterval);
    atualizarVisor();
    atualizarBotoesTimer();
  }

  function zerarTimer() {
    if (segundosDecorridos() > 0 &&
        !confirm("Descartar o tempo atual sem salvar?")) {
      return;
    }

    clearInterval(timerInterval);
    inicioContagem = null;
    tempoAcumulado = 0;
    materiaEmAndamento = null;
    atualizarVisor();
    atualizarBotoesTimer();
  }

  async function finalizarTimer() {
    const minutos = Math.floor(segundosDecorridos() / 60);

    if (minutos < 1) {
      mensagem("Estude pelo menos um minuto para registrar.", true);
      return;
    }

    if (minutos > 1440) {
      mensagem("A sessão não pode ultrapassar 24 horas.", true);
      return;
    }

    if (inicioContagem !== null) pausarTimer();

    $("finishTimer").disabled = true;

    try {
      await api("/api/estudos/sessoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materia_id: Number(materiaEmAndamento),
          duracao_minutos: minutos,
          observacoes: $("sessionNotes").value.trim()
        })
      });

      tempoAcumulado = 0;
      inicioContagem = null;
      materiaEmAndamento = null;
      $("sessionNotes").value = "";

      atualizarVisor();
      atualizarBotoesTimer();
      await carregarDados();

      mensagem("Sessão de estudo salva com sucesso! ♡");
    } catch (erro) {
      mensagem(erro.message, true);
      atualizarBotoesTimer();
    }
  }

  async function sair() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.replace("/pages/login.html");
    } catch (erro) {
      mensagem(erro.message, true);
    }
  }

  $("addSubjectBtn").addEventListener("click", () => abrirModal());
  $("addSubjectSecondary").addEventListener("click", () => abrirModal());
  $("closeModal").addEventListener("click", fecharModal);
  $("cancelModal").addEventListener("click", fecharModal);

  $("subjectModal").addEventListener("click", evento => {
    if (evento.target === $("subjectModal")) fecharModal();
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") fecharModal();
  });

  $("subjectForm").addEventListener("submit", salvarMateria);

  $("startTimer").addEventListener("click", iniciarTimer);
  $("pauseTimer").addEventListener("click", pausarTimer);
  $("finishTimer").addEventListener("click", finalizarTimer);
  $("resetTimer").addEventListener("click", zerarTimer);

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", sair);

  window.addEventListener("beforeunload", evento => {
    if (segundosDecorridos() > 0) {
      evento.preventDefault();
      evento.returnValue = "";
    }
  });

  atualizarBotoesTimer();
  carregarDados();
});
