import express from "express";
import {
  MongoClient
} from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import cors from "cors";

const app = express();
const MONGO_URL = process.env.MONGO_URL;
const PORT = process.env.PORT;
const API = process.env.API;

//create connection
async function createConnection() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  console.log("Connected to mongodb");
  return client;
}

export const client = await createConnection();
app.use(express.json());
app.use(cors())

app.get("/", (req, res) => {
  res.send("<h1>Hello,😊<br> Password Reset Application</h1>");
});

//Signup API
app.post("/users/signup", async (req, res) => {
 
  const {email, password} = req.body;
  console.log(`email: ${email}, pass: ${password}`);
  try {
    const user = await client
      .db("shruthi")
      .collection("users")
      .findOne({
        email: email
      });
    //console.log(`user email: ${user.email}`);
    if (user) {
      res.status(404).send({
        message: "User already exist"
      });
      return;
    }

    //Creating user 
    await client
      .db("shruthi")
      .collection("users")
      .insertOne({
        email: email,
        password: password
      });
    res.status(200).send({
      message: "Signup Successful"
    });

  } catch (err) {
    console.log({
      message: err.message
    });
    res.status(505).send({
      message: "Internal server Error"
    });
  }
});

//Login API
app.post("/users/login", async (req, res) => {
  const {email, password} = req.body;
  //console.log(`email: ${email}, pass: ${password}`);
  try {
    const user = await client
      .db("shruthi")
      .collection("users")
      .findOne({
        email: email
      });
    //console.log(`user email: ${user.email}`);
    if (!user) {
      res.status(404).send({
        message: "Invalid Credentials"
      });
      return;
    }

    const passwordFromDB = user.password;
    //console.log(`DB pass: ${passwordFromDB}`);
    if(passwordFromDB !== password) {
      res.status(404).send({
        message: "Invalid Credentials"
      });
      return;
    }
    else{
      res.status(200).send({
        message: "Login Successful"
      });
    }

  } catch (err) {
    console.log({
      message: err.message
    });
    res.status(505).send({
      message: "Internal server Error"
    });
  }
});

//Forgot Password API
app.post("/users/forgotpass", async (req, res) => {
  const {
    email
  } = req.body;
  console.log(email);
  const userEmailFromDB = await client
    .db("shruthi")
    .collection("users")
    .findOne({
      email: email
    });
  if (!userEmailFromDB) {
    res.status(400).send({
      message: "Invalid EmailId"
    });
    return;
  }
  const token = jwt.sign({
    email: email
  }, process.env.SECRET_KEY);
  //console.log(`token is ${token}`);

  try {
    //sending email to user
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        //user: "sonu.azul@gmail.com",
        //pass: "hpaeqcwqfxucclsh",
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_PASS,
      },
    });

    const mailOptions = {
      from: `${SENDER_EMAIL}` ,
      to: `${email}`,
      subject: "Test Email from Node.js",
      text: `Hello, reset your password using this link below ${API}/resetpass/${token}`,
      //text: `Hello, reset your password using this link below http://localhost:3000/resetpass/${token}`,
    };

    transporter.sendMail(mailOptions, async function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
        //store token in database
        await client
          .db("shruthi")
          .collection("users")
          .updateOne({
            email: email
          }, {
            $set: {
              resetToken: token
            }
          });
      }
    });
  } catch (err) {
    res.send({
      message: err.message
    });
    return;
  }
  //sending response
  res.send({
    message: "user exists",
    token: token
  });
});

//Reset Password API
app.post("/users/resetpass/:token", async (req, res) => {
  //console.log("backeend process of reseting pass started");
  const {
    token
  } = req.params;
  //console.log(`req.query.token= ${req.params.token}`);
  try {
    const user = await client
      .db("shruthi")
      .collection("users")
      .findOne({
        resetToken: token
      });
    //console.log(`user email: ${user.email}`);
    if (!user) {
      res.status(404).send({
        message: "Invalid Token or Token expired"
      });
      return;
    }

    //reseting the password
    const {
      newpass
    } = req.body;
    await client
      .db("shruthi")
      .collection("users")
      .updateOne({
        email: user.email
      }, {
        $set: {
          password: newpass
        }
      });
    //console.log(`new pass is ${newpass}`);
    //Clearing the token
    await client
      .db("shruthi")
      .collection("users")
      .updateOne({
        email: user.email
      }, {
        $set: {
          resetToken: ""
        }
      });

    res.status(200).send({
      message: "Password reset successful"
    });

  } catch (err) {
    console.log({
      message: err.message
    });
    res.status(505).send({
      message: "Internal server Error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`The server is listing on port ${process.env.PORT}`);
});

console.log("end of index.js");