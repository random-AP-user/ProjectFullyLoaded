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
const server = require("http").createServer(app);
const io = require("socket.io")(server);

// too many hours wasted 
// todo
  //! video upload
  //? change image
  //? change password
  //? list of players
  //?// active count
  //?// delete all active bounty's
  //!// push notification



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
  cookie: {maxAge : 24 * 60 * 60 * 1000},
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
    res.render("home.ejs", { users: rows, username: req.session.username, admin : req.session.admin});
  });
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.redirect("/");
    }
    res.redirect("/");
  });
});

app.post("/loginuser", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  q = "SELECT * FROM users WHERE username = ?";
  db.query(q, [username], async (err, rows, field) => {
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
        res.redirect("/login")
      }
    } else {
      res.redirect("/login")
    }
  });
});

app.get('/profile', (req, res) =>{
  if(req.session.username == undefined){
    res.redirect("/login")
  }else{
    q = "SELECT secretcode , price FROM bounty b WHERE userID = (SELECT userID FROM users u WHERE userID = ?)"
    db.query(q, [req.session.userID], (err, rows, field) =>{
      res.render('profile.ejs', {username : req.session.username, image : req.session.image, id : req.session.userID, query : rows[0]})
    })
  }
})

app.use('/profile', express.static('./public/images'));

app.post("/registeruser", upload.single('userimage'), (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const verifypassword = req.body.verifypassword;
  const userimage = req.file.filename;

  q = "SELECT * FROM users WHERE username = ?";
  db.query(q, [username], (err, rows, field) => {
    if (err) {
      throw err;
    }

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
        db.query(q, [username, hashedPassword, userimage], (err, rows, fields) => {
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


app.post("/claim", (req, res) =>{
  if(req.session.username == undefined){
    res.redirect("/login")
  }else{
    res.render("claimbounty.ejs")
  }
})

app.post("/clameconfirm", (req, res) => {
  if(req.session.username == undefined){
    res.redirect("/login")
  } else{
    const bountypass = req.body.bountypass;
    q = "SELECT * FROM `bounty` WHERE secretcode = ?";
    db.query(q, [bountypass], (err, rows, fields) => {
        if(err) throw err
        const userID = req.session.userID;
        const killedID = rows[0].userID;
        const price = rows[0].price;
        const bountyID = rows[0].bountyID
        if (rows.length > 0 && userID != killedID) {
            q2 = "INSERT INTO collectedbounty (userID, killedID, price) VALUES (?, ?, ?);";
            db.query(q2, [userID, killedID, price], (err, rows, fields) => {
                q3 = "DELETE FROM bounty WHERE bountyID = ?"
                db.query(q3, [bountyID], (err, rows, fields) => {
                  if(err) throw err
                  io.sockets.emit("bountyUpdate");
                  res.redirect("/");
                })
            });
            
        } else {
            console.log("no");
            res.render("claimbounty.ejs");
        }
    });
  }
});

app.get("/collected", (req, res) => {
  if(req.session.userID == undefined){
    res.redirect("/login")
  }else{
    userID = req.session.userID
    q = "SELECT price, (SELECT username FROM users u WHERE u.userID = c.killedID ) AS victim FROM collectedbounty c WHERE c.userID = ? AND collected = 0;"
    db.query(q, [userID], (err,rows,fields) =>{
      q2 = "SELECT price, (SELECT username FROM users u WHERE u.userID = c.killedID ) AS victim FROM collectedbounty c WHERE c.userID = ? AND collected = 1;"
      db.query(q2, [userID], (err2,rows2,fields2) =>{
        res.render("collectedbounty.ejs", { notcollected : rows, iscollected : rows2})
      })
    })
  }
})

app.post("/addbounty", (req, res) => {
  const userID = req.body.userID;
  const price = req.body.price;
  
  q = "select username, image from users where userID = ?"
  db.query(q, [userID], (err, row, field) =>{
    message = `Bounty on ${row[0].username}\nReward: ৳${req.body.price}`;
    fullUrl = `${req.protocol}://${req.get('host')}/images/`
    icon = `${fullUrl}${row[0].image}`
    //? if future me forgets the DUAL creates an empty row and column tldr DUAL = (select 1)
    const number = Math.floor(Math.random()*10001);
    q2 = "INSERT INTO `bounty` (`userID`, `price`, `secretcode`) VALUES (?, ?, LPAD(FLOOR(RAND() * 10000), 4));";
    db.query(q2, [userID, price], (err2, row2, field2) => {
      if (err) throw err;
      io.sockets.emit("bountyUpdate");
      sendPushNotification("ALERT: New Bounty", message, icon);
      res.redirect("/admin");
    });
  });
})
app.post("/changebounty", (req,res) => {
  const bountyID = req.body.bountyID
  const price = req.body.price
  q="UPDATE bounty SET price = ? WHERE bountyID = ?"
  db.query(q, [price, bountyID], (err, row,field) => {
    if(err) throw err
    io.sockets.emit("bountyUpdate");
    res.redirect("/admin")
  })
})

app.post("/deletebounty", (req, res) => {
  const bountyID = req.body.bountyID;
  q3 = "DELETE FROM bounty WHERE bountyID = ?";
  db.query(q3, [bountyID], (err, rows, fields) => {
    if (err) throw err;
    io.sockets.emit("bountyUpdate");
    res.redirect("/admin");
  });
});

app.post("/deleteAllBounty", (req, res) => {
  const bountyID = req.body.bountyID;
  q3 = "DELETE FROM bounty WHERE bountyID > 0";
  db.query(q3, [bountyID], (err, rows, fields) => {
    if (err) throw err;
    io.sockets.emit("bountyUpdate");
    res.redirect("/admin");
  });
});


app.get("/admin", (req, res) =>{
  if(req.session.admin != 1){
    res.redirect("/")
  }else{
    q1 = "SELECT u.userID, u.username, u.image FROM users u WHERE u.userID NOT IN (SELECT b.userID FROM bounty b);";
    db.query(q1, (err1, rows1, fields1) => {
      if (err1) {
        throw err1;
      }
      q2 = "SELECT u.userID, u.username, u.image, b.price, b.bountyID FROM users u JOIN bounty b ON u.userID = b.userID";
      db.query(q2, (err2, rows2, fields2) => {
        if (err2) {
          throw err2;
        }
        
        res.render("admin.ejs", { AVusers: rows1, ACusers: rows2, username: req.session.username });
      });
    }); 
  }
})

app.get("/getUpdatedBounties", (req, res) => {
  q = "SELECT u.username, u.image, b.price FROM users u LEFT JOIN bounty b ON u.userID = b.userID WHERE u.userID = b.userID ORDER BY b.price DESC";
  db.query(q, (err, rows, fields) => {
    if (err) {
      console.error('Error executing SQL query:', err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    res.json({ updatedBountyContent: rows });
  });
});

app.get("/userslist", (req, res) =>{
  q = "SELECT username, image FROM users ORDER BY username"
  db.query(q, (err, rows, fields) =>{
    if (err) {
      throw err;
    }
    res.render("userslist.ejs", {users: rows})
  })
})

// active users
function test(){
  io.sockets.emit("activeUsers")
}
app.get("/refreshUsers", (req,res) =>{
  activeUsers = io.engine.clientsCount
  res.json({ activeUsers : activeUsers });
})

setInterval(test, 2000)

// web push notif

const publicVapidKey = process.env.publicKey;
const privateVapidKey = process.env.privateKey;

webpush.setVapidDetails(
  "mailto:trustyourai@gmail.com",
  publicVapidKey,
  privateVapidKey
);

app.get("/test", (req, res) =>{
  title = "ALERT: New Bounty";
  message = `Bounty on ${req.session.username}\nReward: $200`;
  fullUrl = `${req.protocol}://${req.get('host')}/images/`
  icon = `${fullUrl}${req.session.image}`
  sendPushNotification(title, message, icon);
  res.render("test.ejs");
})

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

const subscribers = require("./subscribers.json")
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
              console.log("Subscription is no longer valid, remove it from your list \n" + JSON.stringify(subscription));
              subscribers.splice(i, 1);
              i--;
          } else {
              console.error("Error sending notification:", error);
          }
      }
  }
  fs.writeFileSync("./subscribers.json", JSON.stringify(subscribers, null, 2));
  console.log("finnished sending all notification")
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

// defender firwerall
// telenet
//    local ip | external port | internal port | protocol
//   laptop ip |    79-81      |  server port  |  Both
// inbound = server port
// outbound = port 80
//ipethernet = "192.168.0.166";

port = 3000;
// ipwifi = getIPAddress();
ipwifi = "192.168.0.166";

server.listen(port, ipwifi, () => {
  console.log(`Server is running on http://${ipwifi}:${port}`);
});