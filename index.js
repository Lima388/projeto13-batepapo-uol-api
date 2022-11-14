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

try {
  await mongoClient.connect();
} catch (err) {
  console.log(err);
}

const db = mongoClient.db(process.env.DATABASE_NAME);
const participantsCollection = db.collection("participants");
const messagesCollection = db.collection("messages");

participantsCollection.createIndex({ name: 1 }, { unique: true });

app.post("/participants", async (req, res) => {
  const user = req.body;

  const validation = userSchema.validate(user, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  user.lastStatus = Date.now();

  try {
    await participantsCollection.insertOne(user);
    await messagesCollection.insertOne({
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
  const message = req.body;

  const validation = messageSchema.validate(message, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    res.status(422).send(errors);
    return;
  }

  message.from = req.header("User");
  message.time = dayjs().format("HH:mm:ss");

  try {
    const userSignedIn = await participantsCollection.findOne({
      name: message.from,
    });
    if (!userSignedIn) {
      return res.sendStatus(422);
    }

    await messagesCollection.insertOne(message);

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await participantsCollection.find().toArray();
    res.send(participants);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.header("User");
  try {
    let messages = await messagesCollection.find().toArray();
    messages = messages.filter((message) => {
      if (message.type !== "private_message") return true;
      if (message.from === user) return true;
      if (message.to === user) return true;
      return false;
    });
    if (limit > 0) {
      messages = messages.slice(-limit);
    }
    res.send(messages);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const user = req.header("User");
  try {
    const userSignedIn = await participantsCollection.findOne({ name: user });
    if (!userSignedIn) {
      return res.sendStatus(404);
    }

    await participantsCollection.updateOne(
      {
        name: user,
      },
      {
        $set: { lastStatus: Date.now() },
      }
    );
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

setInterval(() => {
  removeIdleParticipants();
}, 15000);

async function removeIdleParticipants() {
  const participants = await participantsCollection.find().toArray();
  for (let i = 0; i < participants.length; i++) {
    if (Date.now() - participants[i].lastStatus > 10000) {
      participantsCollection.deleteOne({ name: participants[i].name });
      messagesCollection.insertOne({
        from: participants[i].name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      });
    }
  }
}
app.listen(process.env.APP_PORT, () =>
  console.log("Server running in port 5000")
);
