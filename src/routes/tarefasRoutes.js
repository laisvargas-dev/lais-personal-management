
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.use((req, res, next) => {
  if (!req.session?.usuarioId) {
    return res.status(401).json({
      mensagem: "Você precisa fazer login."
    });
  }
  next();
});

function validarTarefa(body) {
  const titulo = String(body.titulo || "").trim();
  const descricao = String(body.descricao || "").trim();
  const prioridade = String(body.prioridade || "media").toLowerCase();
  const concluida = body.concluida === true;
  const dataLimite = body.data_limite || null;

  if (!titulo || titulo.length > 150) {
    return { erro: "Informe um título de até 150 caracteres." };
  }

  if (descricao.length > 5000) {
    return { erro: "Descrição muito longa." };
  }

  if (!["baixa", "media", "alta"].includes(prioridade)) {
    return { erro: "Prioridade inválida." };
  }

  if (dataLimite !== null) {
    if (typeof dataLimite !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dataLimite)) {
      return { erro: "Data limite inválida." };
    }

    const [ano, mes, dia] = dataLimite.split("-").map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));

    if (data.getUTCFullYear() !== ano ||
        data.getUTCMonth() !== mes - 1 ||
        data.getUTCDate() !== dia) {
      return { erro: "Data limite inválida." };
    }
  }

  return {
    titulo,
    descricao,
    prioridade,
    concluida,
    dataLimite
  };
}

function validarId(id) {
  return Number.isSafeInteger(id) && id > 0;
}

// LISTAR TAREFAS
router.get("/", async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT id, titulo, descricao, prioridade, concluida,
              TO_CHAR(data_limite, 'YYYY-MM-DD') AS data_limite,
              TO_CHAR(criado_em, 'YYYY-MM-DD"T"HH24:MI:SS') AS criado_em
       FROM tarefas
       WHERE usuario_id = $1
       ORDER BY concluida ASC,
                data_limite ASC NULLS LAST,
                criado_em DESC`,
      [req.session.usuarioId]
    );

    res.json(resultado.rows);
  } catch (erro) {
    next(erro);
  }
});

// CADASTRAR TAREFA
router.post("/", async (req, res, next) => {
  try {
    const dados = validarTarefa(req.body);

    if (dados.erro) {
      return res.status(400).json({ mensagem: dados.erro });
    }

    const resultado = await pool.query(
      `INSERT INTO tarefas
       (usuario_id, titulo, descricao, prioridade,
        concluida, data_limite)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        req.session.usuarioId,
        dados.titulo,
        dados.descricao,
        dados.prioridade,
        dados.concluida,
        dados.dataLimite
      ]
    );

    res.status(201).json({
      mensagem: "Tarefa cadastrada!",
      id: resultado.rows[0].id
    });
  } catch (erro) {
    next(erro);
  }
});

// EDITAR TAREFA
router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!validarId(id)) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    const dados = validarTarefa(req.body);

    if (dados.erro) {
      return res.status(400).json({ mensagem: dados.erro });
    }

    const resultado = await pool.query(
      `UPDATE tarefas
       SET titulo = $1,
           descricao = $2,
           prioridade = $3,
           concluida = $4,
           data_limite = $5
       WHERE id = $6 AND usuario_id = $7
       RETURNING id`,
      [
        dados.titulo,
        dados.descricao,
        dados.prioridade,
        dados.concluida,
        dados.dataLimite,
        id,
        req.session.usuarioId
      ]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada."
      });
    }

    res.json({ mensagem: "Tarefa atualizada!" });
  } catch (erro) {
    next(erro);
  }
});

// MARCAR OU DESMARCAR COMO CONCLUÍDA
router.patch("/:id/concluir", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!validarId(id)) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    if (typeof req.body.concluida !== "boolean") {
      return res.status(400).json({
        mensagem: "Informe concluida como true ou false."
      });
    }

    const resultado = await pool.query(
      `UPDATE tarefas
       SET concluida = $1
       WHERE id = $2 AND usuario_id = $3
       RETURNING id, concluida`,
      [req.body.concluida, id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada."
      });
    }

    res.json(resultado.rows[0]);
  } catch (erro) {
    next(erro);
  }
});

// EXCLUIR TAREFA
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!validarId(id)) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    const resultado = await pool.query(
      `DELETE FROM tarefas
       WHERE id = $1 AND usuario_id = $2
       RETURNING id`,
      [id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Tarefa não encontrada."
      });
    }

    res.json({ mensagem: "Tarefa excluída!" });
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
