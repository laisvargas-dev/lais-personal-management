
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  let calendario = null;
  let eventos = [];
  let mensagemTimer = null;

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

  function dataLocal(data = new Date()) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    const hora = String(data.getHours()).padStart(2, "0");
    const minuto = String(data.getMinutes()).padStart(2, "0");

    return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
  }

  function adicionarHoras(data, horas) {
    const copia = new Date(data);
    copia.setHours(copia.getHours() + horas);
    return dataLocal(copia);
  }

  function abrirModal(evento = null, dataSelecionada = null) {
    $("eventForm").reset();

    $("eventId").value = evento?.id || "";
    $("modalTitle").textContent = evento
      ? "Editar compromisso ♡"
      : "Novo compromisso ♡";

    $("eventTitle").value = evento?.titulo || "";
    $("eventDescription").value = evento?.descricao || "";
    $("eventColor").value = evento?.cor || "#EC4899";

    if (evento) {
      $("eventStart").value = evento.inicio;
      $("eventEnd").value = evento.fim;
    } else {
      let inicio = dataSelecionada || dataLocal();

      if (inicio.length === 10) {
        inicio += "T09:00";
      }

      $("eventStart").value = inicio;
      $("eventEnd").value = adicionarHoras(
        new Date(inicio),
        1
      );
    }

    $("deleteEventBtn").hidden = !evento;
    $("eventModal").hidden = false;
    $("eventTitle").focus();
  }

  function fecharModal() {
    $("eventModal").hidden = true;
    $("eventForm").reset();
  }

  function formatarData(data) {
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function atualizarIndicadores() {
    const agora = new Date();
    const hoje = dataLocal(agora).slice(0, 10);

    const daquiSeteDias = new Date(agora);
    daquiSeteDias.setDate(daquiSeteDias.getDate() + 7);

    const hojeTotal = eventos.filter((evento) =>
      evento.inicio.slice(0, 10) === hoje
    ).length;

    const semanaTotal = eventos.filter((evento) => {
      const inicio = new Date(evento.inicio);
      return inicio >= agora && inicio < daquiSeteDias;
    }).length;

    $("todayCount").textContent = hojeTotal;
    $("weekCount").textContent = semanaTotal;
    $("totalCount").textContent = eventos.length;
  }

  function atualizarProximos() {
    const lista = $("upcomingList");
    lista.replaceChildren();

    const agora = new Date();

    const proximos = eventos
      .filter((evento) => new Date(evento.fim) >= agora)
      .sort((a, b) =>
        new Date(a.inicio) - new Date(b.inicio)
      )
      .slice(0, 6);

    if (!proximos.length) {
      const vazio = document.createElement("p");
      vazio.className = "empty";
      vazio.textContent = "Nenhum compromisso futuro. ♡";
      lista.appendChild(vazio);
      return;
    }

    proximos.forEach((evento) => {
      const item = document.createElement("div");
      item.className = "upcoming-item";

      const ponto = document.createElement("span");
      ponto.className = "upcoming-dot";
      ponto.style.backgroundColor = evento.cor;

      const conteudo = document.createElement("div");

      const titulo = document.createElement("strong");
      titulo.textContent = evento.titulo;

      const data = document.createElement("p");
      data.textContent = formatarData(evento.inicio);

      conteudo.append(titulo, data);
      item.append(ponto, conteudo);

      item.style.cursor = "pointer";
      item.addEventListener("click", () => abrirModal(evento));

      lista.appendChild(item);
    });
  }

  function atualizarCalendario() {
    if (!calendario) return;

    calendario.removeAllEvents();

    eventos.forEach((evento) => {
      calendario.addEvent({
        id: String(evento.id),
        title: evento.titulo,
        start: evento.inicio,
        end: evento.fim,
        backgroundColor: evento.cor,
        borderColor: evento.cor
      });
    });
  }

  async function carregarEventos() {
    try {
      eventos = await requisicao("/api/calendario/eventos");

      atualizarIndicadores();
      atualizarProximos();
      atualizarCalendario();
    } catch (erro) {
      mostrarMensagem(erro.message, true);
    }
  }

  async function salvarEvento(eventoFormulario) {
    eventoFormulario.preventDefault();

    const id = $("eventId").value;
    const botao = $("saveEventBtn");

    const dados = {
      titulo: $("eventTitle").value.trim(),
      descricao: $("eventDescription").value.trim(),
      inicio: $("eventStart").value,
      fim: $("eventEnd").value,
      cor: $("eventColor").value
    };

    if (!dados.titulo || !dados.inicio || !dados.fim) {
      mostrarMensagem("Preencha os campos obrigatórios.", true);
      return;
    }

    if (dados.fim <= dados.inicio) {
      mostrarMensagem(
        "O término deve ser posterior ao início.",
        true
      );
      return;
    }

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      await requisicao(
        id
          ? `/api/calendario/eventos/${id}`
          : "/api/calendario/eventos",
        {
          method: id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(dados)
        }
      );

      fecharModal();
      await carregarEventos();

      mostrarMensagem(
        id
          ? "Compromisso atualizado com sucesso! ♡"
          : "Compromisso cadastrado com sucesso! ♡"
      );
    } catch (erro) {
      mostrarMensagem(erro.message, true);
    } finally {
      botao.disabled = false;
      botao.textContent = "Salvar";
    }
  }

  async function excluirEvento() {
    const id = $("eventId").value;

    if (!id) return;

    const confirmado = confirm(
      "Deseja excluir este compromisso?"
    );

    if (!confirmado) return;

    try {
      await requisicao(
        `/api/calendario/eventos/${id}`,
        { method: "DELETE" }
      );

      fecharModal();
      await carregarEventos();

      mostrarMensagem("Compromisso excluído com sucesso!");
    } catch (erro) {
      mostrarMensagem(erro.message, true);
    }
  }

  async function sair() {
    try {
      await requisicao("/api/auth/logout", {
        method: "POST"
      });

      window.location.replace("/pages/login.html");
    } catch (erro) {
      mostrarMensagem(erro.message, true);
    }
  }

  if (typeof FullCalendar === "undefined") {
    mostrarMensagem(
      "Não foi possível carregar o calendário. Verifique sua internet.",
      true
    );
    return;
  }

  calendario = new FullCalendar.Calendar($("calendar"), {
    initialView: "dayGridMonth",
    locale: "pt-br",
    firstDay: 0,
    height: "auto",
    selectable: true,
    nowIndicator: true,

    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },

    buttonText: {
      today: "Hoje",
      month: "Mês",
      week: "Semana",
      day: "Dia"
    },

    dateClick: (info) => {
      abrirModal(null, info.dateStr);
    },

    select: (info) => {
      if (info.allDay) {
        abrirModal(null, info.startStr);
      } else {
        abrirModal(null, dataLocal(info.start));
        $("eventEnd").value = dataLocal(info.end);
      }
    },

    eventClick: (info) => {
      const evento = eventos.find(
        (item) => String(item.id) === info.event.id
      );

      if (evento) {
        abrirModal(evento);
      }
    }
  });

  calendario.render();

  $("addEventBtn").addEventListener("click", () => {
    abrirModal();
  });

  $("closeModal").addEventListener("click", fecharModal);
  $("cancelModal").addEventListener("click", fecharModal);

  $("eventModal").addEventListener("click", (evento) => {
    if (evento.target === $("eventModal")) {
      fecharModal();
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      fecharModal();
    }
  });

  $("eventForm").addEventListener("submit", salvarEvento);

  $("deleteEventBtn").addEventListener(
    "click",
    excluirEvento
  );

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });

  $("logoutBtn").addEventListener("click", sair);

  carregarEventos();
});
