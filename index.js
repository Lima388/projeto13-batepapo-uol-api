import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
});
const userSchema = joi.object({
  name: joi.string().required(),
});

const app = express();

//configs
dotenv.config();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;

try {
  await mongoClient.connect();
  db = mongoClient.db("bate_papo_uol");
} catch (err) {
  console.log(err);
}

db.dropDatabase();

db.createCollection("participants");
db.collection("participants").createIndex({ name: 1 }, { unique: true });

app.post("/participants", async (req, res) => {
  let user = req.body;

  const validation = userSchema.validate(user, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  user.lastStatus = Date.now();

  try {
    await db.collection("participants").insertOne(user);
    await db.collection("messages").insertOne({
      from: user.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    });
    res.status(201).send("Participante adicionado com sucesso!");
  } catch (err) {
    res.status(409).send(err);
  }
});

app.post("/messages", async (req, res) => {
  let message = req.body;

  const validation = messageSchema.validate(message, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  message.from = req.header("User");
  message.time = dayjs().format("HH:mm:ss");

  try {
    const userSignedIn =
      (await db
        .collection("participants")
        .find({ name: message.from })
        .count()) > 0;
    if (!userSignedIn) {
      throw new Exception();
    }

    await db.collection("messages").insertOne(message);

    res.sendStatus(201);
  } catch (err) {
    res.status(422).send(err);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  try {
    const messages = await db.collection("messages").find().toArray();
    res.send(messages);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.listen(5000, () => console.log("Server running in port 5000"));
