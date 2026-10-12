
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const pool = require("./src/config/db");
const protegerRota = require("./src/middlewares/authMiddleware");

const authRoutes = require("./src/routes/authRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const financeiroRoutes = require("./src/routes/financeiroRoutes");
const calendarioRoutes = require("./src/routes/calendarioRoutes");
const estudosRoutes = require("./src/routes/estudosRoutes");
const tarefasRoutes = require("./src/routes/tarefasRoutes");
const metasRoutes = require("./src/routes/metasRoutes");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const emProducao = process.env.NODE_ENV === "production";

if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
) {
  throw new Error(
    "SESSION_SECRET precisa ter pelo menos 32 caracteres."
  );
}

// O Render utiliza proxy HTTPS.
if (emProducao) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({
  extended: false,
  limit: "1mb"
}));

// SESSÕES DE LOGIN
app.use(
  session({
    name: "lais.sid",

    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: false
    }),

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: emProducao,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

// LIMITADOR DE TENTATIVAS DE LOGIN
const limiteAutenticacao = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    erro: "Muitas tentativas. Tente novamente mais tarde."
  }
});

// ARQUIVOS PÚBLICOS
app.use(
  express.static(path.join(__dirname, "public"))
);

// ROTAS DA API
app.use(
  "/api/auth",
  limiteAutenticacao,
  authRoutes
);

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/financeiro", financeiroRoutes);
app.use("/api/calendario", calendarioRoutes);
app.use("/api/estudos", estudosRoutes);
app.use("/api/tarefas", tarefasRoutes);
app.use("/api/metas", metasRoutes);

// PÁGINA INICIAL
app.get("/", (req, res) => {
  res.redirect("/pages/login.html");
});

// DASHBOARD PROTEGIDO
app.get("/dashboard", protegerRota, (req, res) => {
  res.sendFile(
    path.join(__dirname, "private", "dashboard.html")
  );
});

// VERIFICAÇÃO DO SERVIDOR
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    sistema: "Gestão Pessoal | Laís Vargas"
  });
});

// ROTA NÃO ENCONTRADA
app.use((req, res) => {
  res.status(404).json({
    erro: "Página ou rota não encontrada."
  });
});

// TRATAMENTO DE ERROS
app.use((erro, req, res, next) => {
  console.error("Erro no servidor:", erro);

  res.status(500).json({
    erro: "Erro interno do servidor."
  });
});

// INICIAR SERVIDOR
app.listen(PORT, "0.0.0.0", () => {
  console.log("==================================");
  console.log(" GESTÃO PESSOAL | LAÍS VARGAS");
  console.log("==================================");
  console.log(`Servidor iniciado na porta ${PORT}`);
  console.log(
    emProducao
      ? "Ambiente: PRODUÇÃO"
      : "Ambiente: DESENVOLVIMENTO"
  );
});
