
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

function exigirLogin(req, res, next) {
  if (!req.session?.usuarioId) {
    return res.status(401).json({
      mensagem: "Você precisa fazer login."
    });
  }
  next();
}

router.use(exigirLogin);

function validarEvento(body) {
  const titulo = String(body.titulo || "").trim();
  const descricao = String(body.descricao || "").trim();
  const inicio = body.inicio;
  const fim = body.fim;
  const cor = body.cor || "#EC4899";

  if (!titulo || titulo.length > 150) {
    return { erro: "Informe um título de até 150 caracteres." };
  }

  if (descricao.length > 5000) {
    return { erro: "A descrição é muito longa." };
  }

  const formato = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

  if (
    typeof inicio !== "string" ||
    typeof fim !== "string" ||
    !formato.test(inicio) ||
    !formato.test(fim)
  ) {
    return { erro: "Informe datas e horários válidos." };
  }

  function dataValida(valor) {
    const [data, hora] = valor.split("T");
    const [ano, mes, dia] = data.split("-").map(Number);
    const [horas, minutos] = hora.split(":").map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia, horas, minutos));

    return (
      d.getUTCFullYear() === ano &&
      d.getUTCMonth() === mes - 1 &&
      d.getUTCDate() === dia &&
      d.getUTCHours() === horas &&
      d.getUTCMinutes() === minutos
    );
  }

  if (!dataValida(inicio) || !dataValida(fim) || fim <= inicio) {
    return {
      erro: "O término deve ser posterior ao início."
    };
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(cor)) {
    return { erro: "Cor inválida." };
  }

  return { titulo, descricao, inicio, fim, cor };
}

// LISTAR EVENTOS
router.get("/eventos", async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT id, titulo, descricao,
              TO_CHAR(inicio, 'YYYY-MM-DD"T"HH24:MI') AS inicio,
              TO_CHAR(fim, 'YYYY-MM-DD"T"HH24:MI') AS fim,
              cor
       FROM eventos
       WHERE usuario_id = $1
       ORDER BY inicio ASC`,
      [req.session.usuarioId]
    );

    res.json(resultado.rows);
  } catch (erro) {
    next(erro);
  }
});

// CADASTRAR EVENTO
router.post("/eventos", async (req, res, next) => {
  try {
    const dados = validarEvento(req.body);

    if (dados.erro) {
      return res.status(400).json({
        mensagem: dados.erro
      });
    }

    const resultado = await pool.query(
      `INSERT INTO eventos
       (usuario_id, titulo, descricao, inicio, fim, cor)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        req.session.usuarioId,
        dados.titulo,
        dados.descricao,
        dados.inicio,
        dados.fim,
        dados.cor
      ]
    );

    res.status(201).json({
      mensagem: "Compromisso cadastrado!",
      id: resultado.rows[0].id
    });
  } catch (erro) {
    next(erro);
  }
});

// EDITAR EVENTO
router.put("/eventos/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const dados = validarEvento(req.body);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID inválido."
      });
    }

    if (dados.erro) {
      return res.status(400).json({
        mensagem: dados.erro
      });
    }

    const resultado = await pool.query(
      `UPDATE eventos
       SET titulo = $1,
           descricao = $2,
           inicio = $3,
           fim = $4,
           cor = $5
       WHERE id = $6 AND usuario_id = $7
       RETURNING id`,
      [
        dados.titulo,
        dados.descricao,
        dados.inicio,
        dados.fim,
        dados.cor,
        id,
        req.session.usuarioId
      ]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Compromisso não encontrado."
      });
    }

    res.json({ mensagem: "Compromisso atualizado!" });
  } catch (erro) {
    next(erro);
  }
});

// EXCLUIR EVENTO
router.delete("/eventos/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID inválido."
      });
    }

    const resultado = await pool.query(
      `DELETE FROM eventos
       WHERE id = $1 AND usuario_id = $2
       RETURNING id`,
      [id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Compromisso não encontrado."
      });
    }

    res.json({ mensagem: "Compromisso excluído!" });
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
