import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";

const userSchema = joi.object({
  to: joi.string().required().min(3).max(100),
  text: joi.string().required(),
  type: joi.string().required(),
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
  db = mongoClient.db("tastecamp");
} catch (err) {
  console.log(err);
}
