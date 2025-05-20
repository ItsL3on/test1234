require("dotenv").config();
const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const http = require("http");
const socketIo = require("socket.io");
const bodyParser = require("body-parser");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const db = new sqlite3.Database("./logs.db");

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(session({
    secret: "gta_secret",
    resave: false,
    saveUninitialized: true
}));

// Middleware für Login
function requireLogin(req, res, next) {
    if (req.session.loggedIn) {
        next();
    } else {
        res.redirect("/login");
    }
}

// WebSocket
io.on("connection", (socket) => {
    console.log("Client verbunden");
});

// Login-Routen
app.get("/login", (req, res) => res.render("login"));
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        req.session.loggedIn = true;
        res.redirect("/");
    } else {
        res.render("login", { error: "Falsche Zugangsdaten" });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

// Hauptseite
app.get("/", requireLogin, (req, res) => {
    const { user, event } = req.query;
    let query = "SELECT * FROM logs WHERE 1=1";
    const params = [];

    if (user) {
        query += " AND user LIKE ?";
        params.push(`%${user}%`);
    }
    if (event) {
        query += " AND event LIKE ?";
        params.push(`%${event}%`);
    }
    query += " ORDER BY id DESC LIMIT 100";

    db.all(query, params, (err, rows) => {
        res.render("index", { logs: rows, user: user || "", event: event || "" });
    });
});

// Webhook
app.post("/webhook", (req, res) => {
    const log = {
        timestamp: new Date().toISOString(),
        event: req.body.event || "Unbekanntes Event",
        user: req.body.user || "Unbekannter Spieler",
        details: req.body.details || ""
    };

    db.run("INSERT INTO logs (timestamp, event, user, details) VALUES (?, ?, ?, ?)",
        [log.timestamp, log.event, log.user, log.details], (err) => {
            if (!err) io.emit("newLog", log);
        });
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));