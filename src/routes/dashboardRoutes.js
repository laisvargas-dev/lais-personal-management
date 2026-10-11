
const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const protegerRota = require("../middlewares/authMiddleware");

router.use(protegerRota);

router.get("/resumo", async (req, res, next) => {
  try {
    const id = req.usuario.id;

    const [
      financeiro,
      tarefas,
      eventos,
      estudos,
      metas,
      grafico,
      proximasTarefas
    ] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN tipo = 'receita'
            THEN valor ELSE 0 END), 0) AS receitas_total,
          COALESCE(SUM(CASE WHEN tipo = 'despesa'
            THEN valor ELSE 0 END), 0) AS despesas_total,
          COALESCE(SUM(CASE WHEN tipo = 'receita'
            AND data >= date_trunc('month', CURRENT_DATE)
            AND data < date_trunc('month', CURRENT_DATE)
              + interval '1 month'
            THEN valor ELSE 0 END), 0) AS receitas_mes,
          COALESCE(SUM(CASE WHEN tipo = 'despesa'
            AND data >= date_trunc('month', CURRENT_DATE)
            AND data < date_trunc('month', CURRENT_DATE)
              + interval '1 month'
            THEN valor ELSE 0 END), 0) AS despesas_mes
        FROM transacoes
        WHERE usuario_id = $1
      `, [id]),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM tarefas
        WHERE usuario_id = $1 AND concluida = false
      `, [id]),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM eventos
        WHERE usuario_id = $1
          AND inicio >= CURRENT_DATE
          AND inicio < CURRENT_DATE + interval '1 day'
      `, [id]),

      pool.query(`
        SELECT COALESCE(SUM(duracao_minutos), 0)::int
          AS minutos
        FROM sessoes_estudo
        WHERE usuario_id = $1
          AND inicio >= date_trunc('week', CURRENT_DATE)
          AND inicio < date_trunc('week', CURRENT_DATE)
            + interval '1 week'
      `, [id]),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM metas
        WHERE usuario_id = $1 AND concluida = false
      `, [id]),

      pool.query(`
        SELECT
          TO_CHAR(data, 'YYYY-MM') AS mes,
          COALESCE(SUM(CASE WHEN tipo = 'receita'
            THEN valor ELSE 0 END), 0) AS receitas,
          COALESCE(SUM(CASE WHEN tipo = 'despesa'
            THEN valor ELSE 0 END), 0) AS despesas
        FROM transacoes
        WHERE usuario_id = $1
          AND data >= date_trunc('month', CURRENT_DATE)
            - interval '5 months'
          AND data < date_trunc('month', CURRENT_DATE)
            + interval '1 month'
        GROUP BY TO_CHAR(data, 'YYYY-MM')
        ORDER BY mes
      `, [id]),

      pool.query(`
        SELECT id, titulo, prioridade, data_limite
        FROM tarefas
        WHERE usuario_id = $1 AND concluida = false
        ORDER BY data_limite ASC NULLS LAST, id DESC
        LIMIT 5
      `, [id])
    ]);

    const f = financeiro.rows[0];

    res.json({
      usuario: req.usuario,
      financeiro: {
        saldo: Number(f.receitas_total) -
          Number(f.despesas_total),
        receitasMes: Number(f.receitas_mes),
        despesasMes: Number(f.despesas_mes)
      },
      tarefasPendentes: tarefas.rows[0].total,
      compromissosHoje: eventos.rows[0].total,
      horasEstudadas:
        Number((estudos.rows[0].minutos / 60).toFixed(1)),
      metasAndamento: metas.rows[0].total,
      grafico: grafico.rows.map(item => ({
        mes: item.mes,
        receitas: Number(item.receitas),
        despesas: Number(item.despesas)
      })),
      proximasTarefas: proximasTarefas.rows
    });

  } catch (erro) {
    next(erro);
  }
});

module.exports = router;
