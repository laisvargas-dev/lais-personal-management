const express = require("express");
const router = express.Router();

const {
  cadastrar,
  login,
  perfil,
  logout
} = require("../controllers/authController");

const protegerRota = require("../middlewares/authMiddleware");

router.post("/cadastro", cadastrar);
router.post("/login", login);
router.get("/perfil", protegerRota, perfil);
router.post("/logout", protegerRota, logout);

module.exports = router;