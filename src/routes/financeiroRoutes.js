
const express = require("express");
const router = express.Router();

const pool = require("../config/db");

// Verificar autenticação
function exigirLogin(req, res, next) {
  if (!req.session || !req.session.usuarioId) {
    return res.status(401).json({
      mensagem: "Você precisa fazer login."
    });
  }

  next();
}

router.use(exigirLogin);

// Validar dados de transação
function validarTransacao(body) {
  const descricao = String(body.descricao || "").trim();
  const tipo = body.tipo;
  const valor = Number(body.valor);
  const data = body.data;

  if (!descricao || descricao.length > 200) {
    return {
      erro: "Informe uma descrição de até 200 caracteres."
    };
  }

  if (tipo !== "receita" && tipo !== "despesa") {
    return {
      erro: "Tipo inválido. Use receita ou despesa."
    };
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    return {
      erro: "O valor deve ser maior que zero."
    };
  }

  if (
    typeof data !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
    Number.isNaN(Date.parse(data)) ||
    new Date(data).toISOString().slice(0, 10) !== data
  ) {
    return {
      erro: "Informe uma data válida."
    };
  }

  const categoriaId =
    body.categoria_id === "" ||
    body.categoria_id == null
      ? null
      : Number(body.categoria_id);

  if (
    categoriaId !== null &&
    (!Number.isSafeInteger(categoriaId) || categoriaId <= 0)
  ) {
    return { erro: "Categoria inválida." };
  }

  return {
    descricao,
    tipo,
    valor,
    data,
    categoriaId
  };
}

// Verificar se a categoria pertence ao usuário
async function conferirCategoria(categoriaId, usuarioId) {
  if (categoriaId === null) {
    return true;
  }

  const resultado = await pool.query(
    `SELECT id
     FROM categorias_financeiras
     WHERE id = $1 AND usuario_id = $2`,
    [categoriaId, usuarioId]
  );

  return resultado.rowCount > 0;
}

// LISTAR TRANSAÇÕES
router.get("/transacoes", async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT
         id,
         categoria_id,
         descricao,
         valor,
         tipo,
         TO_CHAR(data, 'YYYY-MM-DD') AS data,
         criado_em
       FROM transacoes
       WHERE usuario_id = $1
       ORDER BY data DESC, id DESC`,
      [req.session.usuarioId]
    );

    res.json(resultado.rows);
  } catch (erro) {
    next(erro);
  }
});

// RESUMO FINANCEIRO
router.get("/resumo", async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT
         COALESCE(SUM(
           CASE WHEN tipo = 'receita'
           THEN valor ELSE 0 END
         ), 0) AS receitas,

         COALESCE(SUM(
           CASE WHEN tipo = 'despesa'
           THEN valor ELSE 0 END
         ), 0) AS despesas

       FROM transacoes
       WHERE usuario_id = $1`,
      [req.session.usuarioId]
    );

    const receitas = Number(resultado.rows[0].receitas);
    const despesas = Number(resultado.rows[0].despesas);

    res.json({
      receitas,
      despesas,
      saldo: receitas - despesas
    });
  } catch (erro) {
    next(erro);
  }
});

// CADASTRAR TRANSAÇÃO
router.post("/transacoes", async (req, res, next) => {
  try {
    const dados = validarTransacao(req.body);

    if (dados.erro) {
      return res.status(400).json({
        mensagem: dados.erro
      });
    }

    const categoriaValida = await conferirCategoria(
      dados.categoriaId,
      req.session.usuarioId
    );

    if (!categoriaValida) {
      return res.status(400).json({
        mensagem: "Categoria não encontrada."
      });
    }

    const resultado = await pool.query(
      `INSERT INTO transacoes
       (
         usuario_id,
         categoria_id,
         descricao,
         valor,
         tipo,
         data
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.session.usuarioId,
        dados.categoriaId,
        dados.descricao,
        dados.valor,
        dados.tipo,
        dados.data
      ]
    );

    res.status(201).json({
      mensagem: "Transação cadastrada com sucesso!",
      transacao: resultado.rows[0]
    });
  } catch (erro) {
    next(erro);
  }
});

// EDITAR TRANSAÇÃO
router.put("/transacoes/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const dados = validarTransacao(req.body);

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

    const categoriaValida = await conferirCategoria(
      dados.categoriaId,
      req.session.usuarioId
    );

    if (!categoriaValida) {
      return res.status(400).json({
        mensagem: "Categoria não encontrada."
      });
    }

    const resultado = await pool.query(
      `UPDATE transacoes
       SET
         categoria_id = $1,
         descricao = $2,
         valor = $3,
         tipo = $4,
         data = $5
       WHERE id = $6 AND usuario_id = $7
       RETURNING *`,
      [
        dados.categoriaId,
        dados.descricao,
        dados.valor,
        dados.tipo,
        dados.data,
        id,
        req.session.usuarioId
      ]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Transação não encontrada."
      });
    }

    res.json({
      mensagem: "Transação atualizada com sucesso!",
      transacao: resultado.rows[0]
    });
  } catch (erro) {
    next(erro);
  }
});

// EXCLUIR TRANSAÇÃO
router.delete("/transacoes/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        mensagem: "ID inválido."
      });
    }

    const resultado = await pool.query(
      `DELETE FROM transacoes
       WHERE id = $1 AND usuario_id = $2
       RETURNING id`,
      [id, req.session.usuarioId]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        mensagem: "Transação não encontrada."
      });
    }

    res.json({
      mensagem: "Transação excluída com sucesso!"
    });
  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
