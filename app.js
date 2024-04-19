const os = require('os');
const fs = require('fs');
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const flash = require("connect-flash");
const bodyParser = require("body-parser");
const SharpMulter = require("sharp-multer");
const path = require("path");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const webpush = require("web-push");

dotenv.config({ path: './.env' });

const app = express();

const io = require("socket.io")(app);

// storage engine
const storage = SharpMulter({
  destination: (req, file, cb) => cb(null, "./public/images"),

  imageOptions: {
    fileFormat: "webp",
    quality: 80,
    resize: { width: 400, height: 400, resizeMode: "cover" },
  },
  filename: (og, opt) => {
    newname = Date.now() + "." + opt.fileFormat;
    return newname;
  },
});

const upload = multer({
  storage: storage
});
const db = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE
});

db.connect((err) => {
  if (err) throw err;
  console.log("connection to db succeeded");
});

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware for session management
app.use(session({
  secret: process.env.SESSION_SECRET,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
  saveUninitialized: true,
  resave: true,
}));

app.use(flash());

io.on("connection", (socket) => {
  socket.emit("welcomeMessage", "Welcome to the No Man's Land Event!");
  socket.on("clientMessage", (message) => {
    console.log(`Received message from client: ${message}`);
    socket.broadcast.emit("serverMessage", `Server broadcast: ${message}`);
  });

});

app.get("/", (req, res) => {
  q = "SELECT u.username, u.image, b.price FROM users u LEFT JOIN bounty b ON u.userID = b.userID WHERE u.userID = b.userID ORDER BY b.price DESC";
  db.query(q, (err, rows, field) => {
    if (err) throw err;
    res.render("home.ejs", { users: rows, username: req.session.username, admin: req.session.admin });
  });
});

// Routes and other middleware...

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
