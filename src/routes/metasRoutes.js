
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

function validarId(valor) {
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validarMeta(body) {
  const titulo = String(body.titulo || "").trim();
  const categoria = String(body.categoria || "pessoal").trim();
  const descricao = String(body.descricao || "").trim();
  const progresso = Number(body.progresso);
  const prazo = body.prazo || null;

  if (!titulo || titulo.length > 150) {
    return { erro: "Informe um título de até 150 caracteres." };
  }

  if (!["pessoal", "financeira", "estudos", "profissional", "saude", "outras"].includes(categoria)) {
    return { erro: "Categoria inválida." };
  }

  if (descricao.length > 5000) {
    return { erro: "A descrição está muito longa." };
  }

  if (!Number.isInteger(progresso) || progresso < 0 || progresso > 100) {
    return { erro: "O progresso deve ser de 0 a 100%." };
  }

  if (prazo !== null) {
    if (typeof prazo !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
      return { erro: "Informe uma data válida." };
    }

    const [ano, mes, dia] = prazo.split("-").map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));

    if (data.getUTCFullYear() !== ano ||
        data.getUTCMonth() !== mes - 1 ||
        data.getUTCDate() !== dia) {
      return { erro: "Informe uma data válida." };
    }
  }

  return {
    titulo,
    categoria,
    descricao,
    progresso,
    prazo,
    concluida: progresso === 100
  };
}

// LISTAR METAS
router.get("/", async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT id, titulo, categoria, descricao,
              COALESCE(progresso, 0) AS progresso,
              TO_CHAR(prazo, 'YYYY-MM-DD') AS prazo,
              COALESCE(concluida, false) AS concluida
       FROM metas
       WHERE usuario_id = $1
       ORDER BY concluida ASC, prazo ASC NULLS LAST, id DESC`,
      [req.session.usuarioId]
    );

    res.json(resultado.rows);
  } catch (erro) {
    next(erro);
  }
});

// CADASTRAR META
router.post("/", async (req, res, next) => {
  try {
    const dados = validarMeta(req.body);

    if (dados.erro) {
      return res.status(400).json({ mensagem: dados.erro });
    }

    const resultado = await pool.query(
      `INSERT INTO metas
       (usuario_id, titulo, categoria, descricao, progresso, prazo, concluida)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        req.session.usuarioId,
        dados.titulo,
        dados.categoria,
        dados.descricao,
        dados.progresso,
        dados.prazo,
        dados.concluida
      ]
    );

    res.status(201).json({
      mensagem: "Meta cadastrada com sucesso!",
      id: resultado.rows[0].id
    });
  } catch (erro) {
    next(erro);
  }
});

// EDITAR META
router.put("/:id", async (req, res, next) => {
  try {
    const id = validarId(req.params.id);
    const dados = validarMeta(req.body);

    if (!id) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    if (dados.erro) {
      return res.status(400).json({ mensagem: dados.erro });
    }

    const resultado = await pool.query(
      `UPDATE metas
       SET titulo = $1,
           categoria = $2,
           descricao = $3,
           progresso = $4,
           prazo = $5,
           concluida = $6
       WHERE id = $7 AND usuario_id = $8
       RETURNING id`,
      [
        dados.titulo,
        dados.categoria,
        dados.descricao,
        dados.progresso,
        dados.prazo,
        dados.concluida,
        id,
        req.session.usuarioId
      ]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Meta não encontrada."
      });
    }

    res.json({ mensagem: "Meta atualizada com sucesso!" });
  } catch (erro) {
    next(erro);
  }
});

// ATUALIZAR SOMENTE O PROGRESSO
router.patch("/:id/progresso", async (req, res, next) => {
  try {
    const id = validarId(req.params.id);
    const progresso = Number(req.body.progresso);

    if (!id) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    if (!Number.isInteger(progresso) || progresso < 0 || progresso > 100) {
      return res.status(400).json({
        mensagem: "Informe um progresso entre 0 e 100."
      });
    }

    const resultado = await pool.query(
      `UPDATE metas
       SET progresso = $1, concluida = $2
       WHERE id = $3 AND usuario_id = $4
       RETURNING id, progresso, concluida`,
      [progresso, progresso === 100, id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Meta não encontrada."
      });
    }

    res.json(resultado.rows[0]);
  } catch (erro) {
    next(erro);
  }
});

// EXCLUIR META
router.delete("/:id", async (req, res, next) => {
  try {
    const id = validarId(req.params.id);

    if (!id) {
      return res.status(400).json({ mensagem: "ID inválido." });
    }

    const resultado = await pool.query(
      `DELETE FROM metas
       WHERE id = $1 AND usuario_id = $2
       RETURNING id`,
      [id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Meta não encontrada."
      });
    }

    res.json({ mensagem: "Meta excluída com sucesso!" });
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
