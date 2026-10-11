const pool = require("../config/db");

async function protegerRota(req, res, next) {
  try {
    if (!req.session.usuarioId) {
      return res.status(401).json({
        mensagem: "Você precisa fazer login."
      });
    }

    const resultado = await pool.query(
      "SELECT id, nome, email FROM usuarios WHERE id = $1",
      [req.session.usuarioId]
    );

    if (!resultado.rows.length) {
      return res.status(401).json({
        mensagem: "Sessão inválida."
      });
    }

    req.usuario = resultado.rows[0];
    next();

  } catch (erro) {
    next(erro);
  }
}

module.exports = protegerRota;