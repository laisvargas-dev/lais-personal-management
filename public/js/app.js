
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const cadastroForm = document.getElementById("cadastroForm");
  const mensagem = document.getElementById("mensagem");

  function mostrarMensagem(texto, tipo = "error") {
    if (!mensagem) return;
    mensagem.textContent = texto;
    mensagem.className = `message ${tipo}`;
  }

  function definirBotao(form, carregando) {
    const botao = form?.querySelector('button[type="submit"]');
    if (!botao) return;
    botao.disabled = carregando;
    botao.innerHTML = carregando
      ? '<span>⏳</span> Processando...'
      : botao.dataset.textoOriginal || botao.innerHTML;
  }

  async function enviarDados(url, dados) {
    const resposta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify(dados)
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(resultado.mensagem || "Ocorreu um erro.");
    }

    return resultado;
  }

  document.querySelectorAll("[data-toggle-password]")
    .forEach((botao) => {
      botao.dataset.textoOriginal = botao.textContent.trim();
      botao.addEventListener("click", () => {
        const campo = document.getElementById(
          botao.dataset.togglePassword
        );

        if (!campo) return;

        campo.type = campo.type === "password"
          ? "text"
          : "password";

        botao.textContent = campo.type === "password"
          ? "Mostrar"
          : "Ocultar";
      });
    });

  if (cadastroForm) {
    const botao = cadastroForm.querySelector('button[type="submit"]');
    if (botao) {
      botao.dataset.textoOriginal = botao.innerHTML;
    }

    cadastroForm.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const dados = {
        nome: document.getElementById("nome").value.trim(),
        email: document.getElementById("email").value.trim(),
        senha: document.getElementById("senha").value,
        confirmarSenha: document.getElementById("confirmarSenha").value
      };

      if (!dados.nome || !dados.email || !dados.senha) {
        mostrarMensagem("Preencha nome, e-mail e senha antes de continuar.");
        return;
      }

      if (dados.senha.length < 8) {
        mostrarMensagem("A senha precisa ter pelo menos 8 caracteres.");
        return;
      }

      if (dados.senha !== dados.confirmarSenha) {
        mostrarMensagem("As senhas não coincidem.");
        return;
      }

      definirBotao(cadastroForm, true);
      mostrarMensagem("Criando sua conta...", "success");

      try {
        await enviarDados("/api/auth/cadastro", dados);

        mostrarMensagem(
          "Conta criada! Redirecionando para o login...",
          "success"
        );

        cadastroForm.reset();

        setTimeout(() => {
          window.location.replace("/pages/login.html");
        }, 1200);

      } catch (erro) {
        mostrarMensagem(erro.message);
        definirBotao(cadastroForm, false);
      }
    });
  }

  if (loginForm) {
    const botao = loginForm.querySelector('button[type="submit"]');
    if (botao) {
      botao.dataset.textoOriginal = botao.innerHTML;
    }

    loginForm.addEventListener("submit", async (evento) => {
      evento.preventDefault();

      const dados = {
        email: document.getElementById("email").value.trim(),
        senha: document.getElementById("senha").value
      };

      if (!dados.email || !dados.senha) {
        mostrarMensagem("Informe seu e-mail e sua senha.");
        return;
      }

      definirBotao(loginForm, true);
      mostrarMensagem("Entrando na sua conta...", "success");

      try {
        await enviarDados("/api/auth/login", dados);
        window.location.href = "/dashboard";
      } catch (erro) {
        mostrarMensagem(erro.message);
        definirBotao(loginForm, false);
      }
    });
  }
});
