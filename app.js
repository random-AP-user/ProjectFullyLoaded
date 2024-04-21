const os = require('os');
const fs = require('fs');
const http = require('http');
const express = require("express");
const session = require("cookie-session");
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
const server = http.createServer(app);

const io = require("socket.io")(server);

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

const upload = multer({ storage: storage });
const db = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE
});

db.connect((err) => {
  if (err) throw err;
});

app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
  db.query(q, (err, rows) => {
    if (err) throw err;
    res.render("home.ejs", { users: rows, username: req.session.username, admin: req.session.admin });
  });
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.post("/loginuser", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  q = "SELECT * FROM users WHERE username = ?";
  db.query(q, [username], async (err, rows) => {
    if (err) {
      res.status(500).send('Error retrieving user');
      return;
    }
    if (rows.length > 0) {
      const isPasswordValid = await bcrypt.compare(password, rows[0].password);
      if (isPasswordValid) {
        req.session.userID = rows[0].userID;
        req.session.username = rows[0].username;
        req.session.image = rows[0].image;
        req.session.admin = rows[0].admin;
        res.redirect("/");
      } else {
        res.redirect("/login");
      }
    } else {
      res.redirect("/login");
    }
  });
});

app.get('/profile', (req, res) => {
  if (req.session.username == undefined) {
    res.redirect("/login");
  } else {
    q = "SELECT secretcode , price FROM bounty b WHERE userID = (SELECT userID FROM users u WHERE userID = ?)";
    db.query(q, [req.session.userID], (err, rows) => {
      res.render('profile.ejs', { username: req.session.username, image: req.session.image, id: req.session.userID, query: rows[0] });
    });
  }
});

app.use('/profile', express.static('./public/images'));

app.post("/registeruser", upload.single('userimage'), (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const verifypassword = req.body.verifypassword;
  const userimage = req.file.filename;

  q = "SELECT * FROM users WHERE username = ?";
  db.query(q, [username], (err, rows) => {
    if (err) throw err;

    if (rows.length > 0) {
      console.log("Duplicate found");
      fs.unlinkSync(req.file.path, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
        } else {
          console.log('File deleted successfully.');
        }
      });
      return res.redirect("/register");
    }

    if (password === verifypassword) {
      bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
        if (hashErr) {
          throw hashErr;
        }
        q = "INSERT INTO users(username, password, image) VALUES (?, ?, ?)";
        db.query(q, [username, hashedPassword, userimage], (err, rows) => {
          if (err) {
            throw err;
          }
          res.redirect("/login");
        });
      });
    } else {
      res.redirect("/register");
    }
  });
});


app.post("/claim", (req, res) => {
  if (req.session.username == undefined) {
    res.redirect("/login");
  } else {
    res.render("claimbounty.ejs");
  }
});

app.post("/clameconfirm", (req, res) => {
  if (req.session.username == undefined) {
    res.redirect("/login");
  } else {
    const bountypass = req.body.bountypass;
    q = "SELECT * FROM `bounty` WHERE secretcode = ?";
    db.query(q, [bountypass], (err, rows) => {
      if (err) throw err;
      const userID = req.session.userID;
      const killedID = rows[0].userID;
      const price = rows[0].price;
      const bountyID = rows[0].bountyID;
      if (rows.length > 0 && userID != killedID) {
        q2 = "INSERT INTO collectedbounty (userID, killedID, price) VALUES (?, ?, ?);";
        db.query(q2, [userID, killedID, price], (err, rows) => {
          q3 = "DELETE FROM bounty WHERE bountyID = ?";
          db.query(q3, [bountyID], (err, rows) => {
            if (err) throw err;
            io.sockets.emit("bountyUpdate");
            res.redirect("/");
          });
        });

      } else {
        console.log("no");
        res.render("claimbounty.ejs");
      }
    });
  }
});

app.get("/collected", (req, res) => {
  if (req.session.userID == undefined) {
    res.redirect("/login");
  } else {
    userID = req.session.userID;
    q = "SELECT price, (SELECT username FROM users u WHERE u.userID = c.killedID ) AS victim FROM collectedbounty c WHERE c.userID = ? AND collected = 0;";
    db.query(q, [userID], (err, rows) => {
      q2 = "SELECT price, (SELECT username FROM users u WHERE u.userID = c.killedID ) AS victim FROM collectedbounty c WHERE c.userID = ? AND collected = 1;";
      db.query(q2, [userID], (err2, rows2) => {
        res.render("collectedbounty.ejs", { notcollected: rows, iscollected: rows2 });
      });
    });
  }
});

app.post("/addbounty", (req, res) => {
  const userID = req.body.userID;
  const price = req.body.price;

  const randomNumber = Math.floor(Math.random() * 10000);
  const formattedRandomNumber = randomNumber.toString().padStart(4, '0');

  q = "select username, image from users where userID = ?";
  db.query(q, [userID], (err, row) => {
    if (err) throw err;
    message = `Bounty on ${row[0].username}\nReward: ৳${req.body.price}`;
    fullUrl = `${req.protocol}://${req.get('host')}/images/`;
    icon = `${fullUrl}${row[0].image}`;
    const number = Math.floor(Math.random() * 10001);
    q2 = "INSERT INTO `bounty` (`userID`, `price`, `secretcode`) VALUES (?, ?, ?);";
    db.query(q2, [userID, price, formattedRandomNumber], (err2, row2) => {
      if (err2) throw err2;
      io.sockets.emit("bountyUpdate");
      sendPushNotification("ALERT: New Bounty", message, icon);
      res.redirect("/admin");
    });
  });
});
app.post("/changebounty", (req, res) => {
  const bountyID = req.body.bountyID;
  const price = req.body.price;
  q = "UPDATE bounty SET price = ? WHERE bountyID = ?";
  db.query(q, [price, bountyID], (err, row) => {
    if (err) throw err;
    io.sockets.emit("bountyUpdate");
    res.redirect("/admin");
  });
});

app.post("/deletebounty", (req, res) => {
  const bountyID = req.body.bountyID;
  q3 = "DELETE FROM bounty WHERE bountyID = ?";
  db.query(q3, [bountyID], (err, rows) => {
    if (err) throw err;
    io.sockets.emit("bountyUpdate");
    res.redirect("/admin");
  });
});

app.post("/deleteAllBounty", (req, res) => {
  const bountyID = req.body.bountyID;
  q3 = "DELETE FROM bounty WHERE bountyID > 0";
  db.query(q3, [bountyID], (err, rows) => {
    if (err) throw err;
    io.sockets.emit("bountyUpdate");
    res.redirect("/admin");
  });
});


app.get("/admin", (req, res) => {
  if (req.session.admin != 1) {
    res.redirect("/");
  } else {
    q1 = "SELECT u.userID, u.username, u.image FROM users u WHERE u.userID NOT IN (SELECT b.userID FROM bounty b);";
    db.query(q1, (err1, rows1) => {
      if (err1) {
        throw err1;
      }
      q2 = "SELECT u.userID, u.username, u.image, b.price, b.bountyID FROM users u JOIN bounty b ON u.userID = b.userID";
      db.query(q2, (err2, rows2) => {
        if (err2) {
          throw err2;
        }

        res.render("admin.ejs", { AVusers: rows1, ACusers: rows2, username: req.session.username });
      });
    });
  }
});

app.get("/users", (req, res) => {
  if (req.session.admin != 1) {
    res.redirect("/");
  } else {
    q = "SELECT * from users";
    db.query(q, (err, row) => {
      if (err) throw err;
      res.render("users.ejs", {username: req.session.username, users: row });
    });
  }
});

app.post("/edituser", upload.single('userimage'), (req, res) => {
  if (req.session.admin != 1) {
    res.redirect("/");
  } else {
    const userID = req.body.userID;
    const username = req.body.username;
    let userimage = req.body.oldimagename;
    console.log('userimage', userimage);
    if (req.file) {
      userimage = req.file.filename;
    }
    if (req.body.password == "") {
      const oldpassword = req.body.oldpassword;
      q = "UPDATE users SET username = ?, password = ?, image = ? WHERE userID = ?";
      db.query(q, [username, oldpassword, userimage, userID], (err, rows) => {
        if (err) {
          throw err;
        }
      });
    } else {
      const password = req.body.password;
      bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
        if (hashErr) {
          throw hashErr;
        }
        console.log(hashedPassword);
        console.log(req.body.oldpassword);
        q = "UPDATE users SET username = ?, password = ?, image = ? WHERE userID = ?";
        db.query(q, [username, hashedPassword, userimage, userID], (err, rows) => {
          if (err) {
            throw err;
          }
        });
      });
    }
    res.redirect("/users");
  }
});

app.get("/getUpdatedBounties", (req, res) => {
  q = "SELECT u.username, u.image, b.price FROM users u LEFT JOIN bounty b ON u.userID = b.userID WHERE u.userID = b.userID ORDER BY b.price DESC";
  db.query(q, (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    res.json({ updatedBountyContent: rows });
  });
});

app.get("/userslist", (req, res) => {
  q = "SELECT username, image FROM users ORDER BY username";
  db.query(q, (err, rows) => {
    if (err) {
      throw err;
    }
    res.render("userslist.ejs", { users: rows });
  });
});

function test() {
  io.sockets.emit("activeUsers");
}
app.get("/refreshUsers", (req, res) => {
  activeUsers = io.engine.clientsCount;
  res.json({ activeUsers: activeUsers });
});

setInterval(test, 2000);

const publicVapidKey = process.env.publicKey;
const privateVapidKey = process.env.privateKey;

webpush.setVapidDetails(
  "mailto:trustyourai@gmail.com",
  publicVapidKey,
  privateVapidKey
);

app.get("/test", (req, res) => {
  title = "ALERT: New Bounty";
  message = `Bounty on ${req.session.username}\nReward: $200`;
  fullUrl = `${req.protocol}://${req.get('host')}/images/`;
  icon = `${fullUrl}${req.session.image}`;
  sendPushNotification(title, message, icon);
  res.render("test.ejs");
});

app.post("/subscribe", async (req, res) => {
  try {
    const subscription = req.body;
    subscribers.push(subscription);

    fs.writeFileSync("./subscribers.json", JSON.stringify(subscribers));

    res.status(201).send("Subscription Saved");
  } catch (error) {
    console.error(error);
  }
});

const subscribers = require("./subscribers.json");
async function sendPushNotification(title, message, icon) {
  for (let i = 0; i < subscribers.length; i++) {
    const subscription = subscribers[i];
    const payload = {
      title: title,
      body: message,
      icon: icon,
    };

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error) {
      if (error.statusCode === 410) {
        subscribers.splice(i, 1);
        i--;
      } else {
        console.error("Error sending notification:", error);
      }
    }
  }
  fs.writeFileSync("./subscribers.json", JSON.stringify(subscribers, null, 2));
}

function getIPAddress() {
  let interfaces = os.networkInterfaces();
  for (let devName in interfaces) {
    let iface = interfaces[devName];

    for (let i = 0; i < iface.length; i++) {
      let alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
        return alias.address;
    }
  }
  return '0.0.0.0';
}

port = process.env.PORT || 10000;
ipwifi = "127.0.0.1";

server.listen(port, () => {
  console.log(`Server is running on http://${ipwifi}:${port}`);
});
