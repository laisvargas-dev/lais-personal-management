
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

function validarMateria(body) {
  const nome = String(body.nome || "").trim();
  const meta = Number(body.meta_horas_semanais);

  if (!nome || nome.length > 100) {
    return { erro: "Informe um nome de até 100 caracteres." };
  }

  if (!Number.isFinite(meta) || meta < 0 || meta > 168) {
    return { erro: "Informe uma meta entre 0 e 168 horas." };
  }

  return { nome, meta };
}

function validarSessao(body) {
  const materiaId = Number(body.materia_id);
  const duracao = Number(body.duracao_minutos);
  const observacoes = String(body.observacoes || "").trim();

  if (!Number.isSafeInteger(materiaId) || materiaId <= 0) {
    return { erro: "Selecione uma matéria válida." };
  }

  if (!Number.isSafeInteger(duracao) ||
      duracao < 1 || duracao > 1440) {
    return { erro: "A duração deve ser de 1 a 1440 minutos." };
  }

  if (observacoes.length > 2000) {
    return { erro: "Observações muito longas." };
  }

  return { materiaId, duracao, observacoes };
}

async function materiaPertenceAoUsuario(id, usuarioId) {
  const resultado = await pool.query(
    `SELECT id FROM materias
     WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId]
  );

  return resultado.rowCount > 0;
}

// LISTAR MATÉRIAS
router.get("/materias", async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nome, meta_horas_semanais
       FROM materias
       WHERE usuario_id = $1
       ORDER BY nome`,
      [req.session.usuarioId]
    );

    res.json(resultado.rows);
  } catch (erro) {
    next(erro);
  }
});

// CADASTRAR MATÉRIA
router.post("/materias", async (req, res, next) => {
  try {
    const dados = validarMateria(req.body);

    if (dados.erro) {
      return res.status(400).json({ mensagem: dados.erro });
    }

    const resultado = await pool.query(
      `INSERT INTO materias
       (usuario_id, nome, meta_horas_semanais)
       VALUES ($1, $2, $3)
       RETURNING id, nome, meta_horas_semanais`,
      [req.session.usuarioId, dados.nome, dados.meta]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    next(erro);
  }
});

// EDITAR MATÉRIA
router.put("/materias/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const dados = validarMateria(req.body);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    if (dados.erro) {
      return res.status(400).json({ mensagem: dados.erro });
    }

    const resultado = await pool.query(
      `UPDATE materias
       SET nome = $1, meta_horas_semanais = $2
       WHERE id = $3 AND usuario_id = $4
       RETURNING id, nome, meta_horas_semanais`,
      [dados.nome, dados.meta, id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Matéria não encontrada."
      });
    }

    res.json(resultado.rows[0]);
  } catch (erro) {
    next(erro);
  }
});

// EXCLUIR MATÉRIA
router.delete("/materias/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    const resultado = await pool.query(
      `SELECT id FROM materias
       WHERE id = $1 AND usuario_id = $2`,
      [id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Matéria não encontrada."
      });
    }

    const sessoes = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM sessoes_estudo
       WHERE materia_id = $1 AND usuario_id = $2`,
      [id, req.session.usuarioId]
    );

    if (sessoes.rows[0].total > 0) {
      return res.status(409).json({
        mensagem: "Essa matéria possui sessões registradas. Exclua as sessões antes de excluir a matéria."
      });
    }

    await pool.query(
      `DELETE FROM materias
       WHERE id = $1 AND usuario_id = $2`,
      [id, req.session.usuarioId]
    );

    res.json({ mensagem: "Matéria excluída!" });
  } catch (erro) {
    next(erro);
  }
});

// LISTAR SESSÕES
router.get("/sessoes", async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT s.id, s.materia_id, m.nome AS materia,
              TO_CHAR(s.inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS inicio,
              s.duracao_minutos, s.observacoes
       FROM sessoes_estudo s
       JOIN materias m ON m.id = s.materia_id
       WHERE s.usuario_id = $1 AND m.usuario_id = $1
       ORDER BY s.inicio DESC, s.id DESC`,
      [req.session.usuarioId]
    );

    res.json(resultado.rows);
  } catch (erro) {
    next(erro);
  }
});

// REGISTRAR SESSÃO
router.post("/sessoes", async (req, res, next) => {
  try {
    const dados = validarSessao(req.body);

    if (dados.erro) {
      return res.status(400).json({ mensagem: dados.erro });
    }

    if (!(await materiaPertenceAoUsuario(
      dados.materiaId, req.session.usuarioId
    ))) {
      return res.status(404).json({
        mensagem: "Matéria não encontrada."
      });
    }

    const resultado = await pool.query(
      `INSERT INTO sessoes_estudo
       (usuario_id, materia_id, inicio, duracao_minutos, observacoes)
       VALUES ($1, $2, NOW(), $3, $4)
       RETURNING id`,
      [
        req.session.usuarioId,
        dados.materiaId,
        dados.duracao,
        dados.observacoes
      ]
    );

    res.status(201).json({
      mensagem: "Sessão registrada!",
      id: resultado.rows[0].id
    });
  } catch (erro) {
    next(erro);
  }
});

// EXCLUIR SESSÃO
router.delete("/sessoes/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    const resultado = await pool.query(
      `DELETE FROM sessoes_estudo
       WHERE id = $1 AND usuario_id = $2
       RETURNING id`,
      [id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Sessão não encontrada."
      });
    }

    res.json({ mensagem: "Sessão excluída!" });
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
