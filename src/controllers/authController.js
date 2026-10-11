const bcrypt = require("bcrypt");
const pool = require("../config/db");

async function cadastrar(req, res, next) {
  try {
    const nome = String(req.body?.nome || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const senha = String(req.body?.senha || "");

    if (!nome || !email || !senha) {
      return res.status(400).json({
        mensagem: "Nome, email e senha são obrigatórios."
      });
    }

    if (senha.length < 8) {
      return res.status(400).json({
        mensagem: "A senha deve ter pelo menos 8 caracteres."
      });
    }

    const usuarioExistente = await pool.query(
      "SELECT id FROM usuarios WHERE email = $1",
      [email]
    );

    if (usuarioExistente.rows.length) {
      return res.status(409).json({
        mensagem: "Este e-mail já está cadastrado."
      });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const resultado = await pool.query(
      "INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email",
      [nome, email, senhaHash]
    );

    const usuario = resultado.rows[0];
    req.session.usuarioId = usuario.id;

    return res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (erro) {
    next(erro);
  }
}

async function login(req, res, next) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const senha = String(req.body?.senha || "");

    if (!email || !senha) {
      return res.status(400).json({
        mensagem: "Email e senha são obrigatórios."
      });
    }

    const resultado = await pool.query(
      "SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1",
      [email]
    );

    const usuario = resultado.rows[0];

    if (!usuario) {
      return res.status(401).json({
        mensagem: "Credenciais inválidas."
      });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({
        mensagem: "Credenciais inválidas."
      });
    }

    req.session.usuarioId = usuario.id;

    return res.json({
      mensagem: "Login realizado com sucesso.",
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (erro) {
    next(erro);
  }
}

async function perfil(req, res) {
  return res.json({
    usuario: req.usuario
  });
}

function logout(req, res) {
  req.session.destroy((erro) => {
    if (erro) {
      return res.status(500).json({
        mensagem: "Não foi possível encerrar a sessão."
      });
    }

    return res.json({
      mensagem: "Logout realizado com sucesso."
    });
  });
}

module.exports = {
  cadastrar,
  login,
  perfil,
  logout
};