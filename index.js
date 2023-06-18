import express from "express";
import {
  MongoClient
} from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import cors from "cors";
import bcrypt from "bcrypt";
import {auth} from "./middleware/auth.js";

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

app.get("/", auth, (req, res) => {
  res.send("<h1>Hello,😊<br> Password Reset Application</h1>");
});

//welcome API
app.post("/welcome/:token", async(req, res) => {
  console.log("Welcome api");
  const {
    token
  } = req.params;
  console.log(`shruthi token ${token}`)
  try {
    const user = await client
    .db("url_shortner")
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
  res.status(200).send({
    message: "Login success"
  });
  }
  catch(err) {
    console.log({
      message: err.message
    });
    res.status(505).send({
      message: "Internal server Error"
    });
  }
  // res.status(200).send({
  //   message: " Hello welcome to url shortner app"
  // })

 // res.send("<h1>Hello,😊<br> Password Reset Application</h1>");
});

//Signup API
app.post("/users/signup", async (req, res) => {
 
  const {email, password} = req.body;
  console.log(`email: ${email}, pass: ${password}`);
  try {
    const user = await client
      .db("url_shortner")
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

    //Creating hashed password
    const salt = await bcrypt.genSalt(10);
    console.log(`salt: ${salt}`);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log(`email: ${email}, hashedPass: ${hashedPassword}`);

    //Creating user 
    await client
      .db("url_shortner")
      .collection("users")
      .insertOne({
        email: email,
        password: hashedPassword
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
      .db("url_shortner")
      .collection("users")
      .findOne({
        email: email
      });
    console.log(`user email: ${user.email}`);
    if (!user) {
      res.status(404).send({
        message: "Invalid Credentials"
      });
      return;
    }

    const passwordFromDB = user.password;
    const isPasswordMatched = await bcrypt.compare(password, passwordFromDB);
    //console.log(`DB pass: ${passwordFromDB}`);
    if(!isPasswordMatched) {
      res.status(404).send({
        message: "Invalid Credentials"
      });
      return;
    } 
    else{
      const token = jwt.sign({id: user._id }, process.env.SECRET_KEY );
      console.log(`token: ${token}`);

      await client
      .db("url_shortner")
      .collection("users")
      .updateOne({
        email: email
      }, {
        $set: {
          resetToken: token
        }
      });
      res.status(200).send({
        message: "Login Successful",
        token: token
      })

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
  console.log("reached backend");
  const {
    email
  } = req.body;
  console.log(email);
  const userEmailFromDB = await client
    .db("url_shortner")
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


  try {
    //sending email to user
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SENDER_EMAIL ,
      to: `${email}`,
      subject: "URL shortener: Reset your password",
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
          .db("url_shortner")
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
      .db("url_shortner")
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

    const salt = await bcrypt.genSalt(10);
    console.log(`salt: ${salt}`);
    const newhashedPassword = await bcrypt.hash(newpass, salt);
    await client
      .db("url_shortner")
      .collection("users")
      .updateOne({
        email: user.email
      }, {
        $set: {
          password: newhashedPassword
        }
      });
 
    //Clearing the token
    await client
      .db("url_shortner")
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