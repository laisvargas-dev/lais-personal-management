
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const pool = require("./src/config/db");

const authRoutes = require("./src/routes/authRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const financeiroRoutes = require("./src/routes/financeiroRoutes");
const calendarioRoutes = require("./src/routes/calendarioRoutes");
const estudosRoutes = require("./src/routes/estudosRoutes");
const tarefasRoutes = require("./src/routes/tarefasRoutes");
const metasRoutes = require("./src/routes/metasRoutes");

const protegerRota = require("./src/middlewares/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32) {
  throw new Error(
    "Configure SESSION_SECRET com pelo menos 32 caracteres no .env"
  );
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new PgSession({
    pool,
    tableName: "session"
  }),
  name: "lais.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    mensagem: "Muitas tentativas. Tente novamente mais tarde."
  }
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/cadastro", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/financeiro", financeiroRoutes);
app.use("/api/calendario", calendarioRoutes);
app.use("/api/estudos", estudosRoutes);
app.use("/api/tarefas", tarefasRoutes);
app.use("/api/metas", metasRoutes);

app.get("/api/status", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      sucesso: true,
      mensagem: "Sistema Laís Vargas funcionando!",
      banco: "PostgreSQL conectado"
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao conectar ao PostgreSQL."
    });
  }
});

app.get("/", (req, res) => {
  res.redirect("/pages/login.html");
});

app.get("/dashboard", protegerRota, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(
    path.join(__dirname, "private", "dashboard.html")
  );
});

app.use(express.static(
  path.join(__dirname, "public"),
  { index: false }
));

app.use((req, res) => {
  res.status(404).json({
    mensagem: "Página ou rota não encontrada."
  });
});

app.use((erro, req, res, next) => {
  console.error("Erro interno:", erro);
  res.status(500).json({
    mensagem: "Erro interno do servidor."
  });
});

app.listen(PORT, () => {
  console.log("--------------------------------");
  console.log("GESTÃO PESSOAL | LAÍS VARGAS");
  console.log("--------------------------------");
  console.log(`Servidor: http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`Financeiro: http://localhost:${PORT}/pages/financas.html`);
  console.log(`Calendário: http://localhost:${PORT}/pages/calendario.html`);
  console.log(`Estudos: http://localhost:${PORT}/pages/estudos.html`);
  console.log(`Tarefas: http://localhost:${PORT}/pages/tarefas.html`);
  console.log(`Metas: http://localhost:${PORT}/pages/metas.html`);
});
